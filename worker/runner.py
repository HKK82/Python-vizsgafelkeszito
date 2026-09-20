import ast
import builtins
import contextlib
import io
import json
import traceback
import os
import tempfile
from collections import Counter, deque

# A tanulói kód külön névtérben fut, de ugyanabban a Python interpreterben.
# Ezeket a referenciákat induláskor elmentjük, hogy egy tanulói monkeypatch
# (pl. json.dumps felülírása) ne tudja az ellenőrző válaszát módosítani.
_JSON_DUMPS = json.dumps
_JSON_LOADS = json.loads
_REAL_IMPORT = builtins.__import__
_REAL_OPEN = builtins.open

# A böngészős gyakorlókörnyezet nem általános célú Python-shell.
# Csak a tananyaghoz szükséges, átnézett modulokat engedjük.
ALLOWED_IMPORT_ROOTS = {"math", "html"}
BLOCKED_NAMES = {
    "__builtins__", "__import__", "__loader__", "__spec__", "__package__",
    "eval", "exec", "compile", "breakpoint", "globals", "locals", "vars",
    "getattr", "setattr", "delattr", "help", "exit", "quit"
}
MAX_CODE_CHARS = 20000
MAX_AST_NODES = 3000
MAX_LITERAL_CHARS = 12000


def _jsonable(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    return repr(value)


def _security_error(message, line=None, text=""):
    return {
        "ok": False,
        "error": {
            "type": "SecurityError",
            "message": message,
            "line": line,
            "text": text,
        },
    }


def analyze_code(code):
    if len(code) > MAX_CODE_CHARS:
        return _security_error(
            f"A program túl hosszú ehhez a gyakorlókörnyezethez (maximum {MAX_CODE_CHARS} karakter)."
        )

    try:
        tree = ast.parse(code, filename="<student>", mode="exec")
    except SyntaxError as exc:
        return {
            "ok": False,
            "error": {
                "type": exc.__class__.__name__,
                "message": str(exc.msg),
                "line": exc.lineno,
                "text": (exc.text or "").rstrip("\n"),
            },
        }

    walked = list(ast.walk(tree))
    if len(walked) > MAX_AST_NODES:
        return _security_error(
            f"A program túl összetett ehhez a gyakorlókörnyezethez (maximum {MAX_AST_NODES} szintaktikai elem)."
        )

    imported_aliases = set()
    for node in walked:
        line = getattr(node, "lineno", None)

        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root not in ALLOWED_IMPORT_ROOTS:
                    return _security_error(
                        f"A(z) {root} modul ebben a gyakorlókörnyezetben nem használható.",
                        line,
                    )
                imported_aliases.add(alias.asname or root)

        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".", 1)[0]
            if node.level or root not in ALLOWED_IMPORT_ROOTS:
                return _security_error(
                    f"A(z) {root or 'relatív'} modulimport ebben a gyakorlókörnyezetben nem használható.",
                    line,
                )
            for alias in node.names:
                if alias.name.startswith("_"):
                    return _security_error("Belső modulnév importálása nem engedélyezett.", line)
                imported_aliases.add(alias.asname or alias.name)

        if isinstance(node, ast.Name) and node.id in BLOCKED_NAMES:
            return _security_error(
                f"A(z) {node.id} név biztonsági okból nem használható ebben a gyakorlókörnyezetben.",
                line,
            )

        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            return _security_error(
                "Belső/dunder attribútumok közvetlen elérése nem engedélyezett.",
                line,
            )

        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("__") and node.name != "__init__":
                return _security_error(
                    f"A(z) {node.name} speciális metódus itt nem definiálható.",
                    line,
                )

        if isinstance(node, ast.Constant) and isinstance(node.value, (str, bytes)):
            if len(node.value) > MAX_LITERAL_CHARS:
                return _security_error(
                    f"Túl nagy literál ({len(node.value)} karakter/bájt).",
                    line,
                )

    # Importált modulok belső állapotát se lehessen átírni (pl. math.sqrt = ...).
    for node in walked:
        targets = []
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        elif isinstance(node, ast.AugAssign):
            targets = [node.target]
        elif isinstance(node, ast.Delete):
            targets = node.targets

        for target in targets:
            if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name):
                if target.value.id in imported_aliases:
                    return _security_error(
                        "Importált modul attribútumainak módosítása nem engedélyezett.",
                        getattr(target, "lineno", None),
                    )

    nodes = Counter()
    calls = Counter()
    ops = Counter()
    functions = {}

    for node in walked:
        nodes[node.__class__.__name__] += 1
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                calls[node.func.id] += 1
            elif isinstance(node.func, ast.Attribute):
                calls[node.func.attr] += 1
        if isinstance(node, ast.BinOp):
            ops[node.op.__class__.__name__] += 1
        elif isinstance(node, ast.BoolOp):
            ops[node.op.__class__.__name__] += 1
        elif isinstance(node, ast.Compare):
            for op in node.ops:
                ops[op.__class__.__name__] += 1
        elif isinstance(node, ast.AugAssign):
            ops[node.op.__class__.__name__] += 1
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions[node.name] = len(node.args.args)

    return {
        "ok": True,
        "summary": {
            "nodes": dict(nodes),
            "calls": dict(calls),
            "ops": dict(ops),
            "functions": functions,
        },
    }

def _safe_path(path, sandbox_dir):
    if sandbox_dir is None:
        raise PermissionError("Fájlművelet csak elkülönített gyakorlómappában engedélyezett.")
    if not isinstance(path, (str, bytes, os.PathLike)):
        raise PermissionError("Csak fájlnévvel megadott fájlművelet engedélyezett.")
    raw = os.fsdecode(os.fspath(path))
    if os.path.isabs(raw):
        raise PermissionError("Abszolút fájlútvonal nem használható.")
    root = os.path.realpath(sandbox_dir)
    candidate = os.path.realpath(os.path.join(root, raw))
    if os.path.commonpath([root, candidate]) != root:
        raise PermissionError("A gyakorlómappán kívüli fájl nem érhető el.")
    return candidate


def _safe_builtins(fake_input, sandbox_dir=None):
    data = dict(vars(builtins))

    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        root = name.split(".", 1)[0]
        if level or root not in ALLOWED_IMPORT_ROOTS:
            raise ImportError(f"A(z) {root} modul ebben a gyakorlókörnyezetben nem használható.")
        return _REAL_IMPORT(name, globals, locals, fromlist, level)

    def safe_open(file, mode="r", *args, **kwargs):
        if kwargs.get("opener") is not None:
            raise PermissionError("Egyedi opener nem használható.")
        safe_file = _safe_path(file, sandbox_dir)
        return _REAL_OPEN(safe_file, mode, *args, **kwargs)

    for name in BLOCKED_NAMES:
        data.pop(name, None)

    data["input"] = fake_input
    data["open"] = safe_open
    data["__import__"] = safe_import
    return data

def _format_error(exc):
    line = None
    text = ""
    if isinstance(exc, SyntaxError):
        line = exc.lineno
        text = (exc.text or "").rstrip("\n")
        message = str(exc.msg)
    else:
        message = str(exc)
        extracted = traceback.extract_tb(exc.__traceback__)
        student_frames = [f for f in extracted if f.filename == "<student>"]
        if student_frames:
            frame = student_frames[-1]
            line = frame.lineno
            text = (frame.line or "").rstrip("\n")
    return {
        "type": exc.__class__.__name__,
        "message": message,
        "line": line,
        "text": text,
    }


def _normalize_lines(text):
    lines = [line.rstrip() for line in text.splitlines()]
    while lines and lines[-1] == "":
        lines.pop()
    return lines


def _build_namespace(inputs, module_name="__main__", sandbox_dir=None):
    queue = deque(str(v) for v in inputs)
    consumed = []

    def fake_input(prompt=""):
        if not queue:
            raise EOFError("Nincs több megadott bemeneti adat.")
        value = queue.popleft()
        consumed.append(value)
        return value

    ns = {
        "__name__": module_name,
        "__builtins__": _safe_builtins(fake_input, sandbox_dir),
    }
    return ns, consumed


def _execute_code_in_dir(code, inputs, analysis, sandbox_dir):
    ns, consumed = _build_namespace(inputs, "__main__", sandbox_dir)
    out = io.StringIO()
    err = io.StringIO()
    try:
        compiled = compile(code, "<student>", "exec")
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            exec(compiled, ns, ns)
        stdout = out.getvalue()
        return {
            "ok": True,
            "stdout": stdout,
            "stdoutLines": _normalize_lines(stdout),
            "stderr": err.getvalue(),
            "inputsUsed": consumed,
            "error": None,
            "ast": analysis["summary"],
        }
    except BaseException as exc:
        stdout = out.getvalue()
        return {
            "ok": False,
            "stdout": stdout,
            "stdoutLines": _normalize_lines(stdout),
            "stderr": err.getvalue(),
            "inputsUsed": consumed,
            "error": _format_error(exc),
            "ast": analysis["summary"],
        }


def execute_code(code, inputs=None, sandbox_dir=None):
    inputs = inputs or []
    analysis = analyze_code(code)
    if not analysis["ok"]:
        return {
            "ok": False,
            "stdout": "",
            "stdoutLines": [],
            "stderr": "",
            "inputsUsed": [],
            "error": analysis["error"],
            "ast": None,
        }

    if sandbox_dir is not None:
        return _execute_code_in_dir(code, inputs, analysis, sandbox_dir)

    with tempfile.TemporaryDirectory() as tmp:
        return _execute_code_in_dir(code, inputs, analysis, tmp)

def execute_code_with_files(code, inputs=None, files=None, read_files=None):
    inputs = inputs or []
    files = files or {}
    read_files = read_files or []
    old_cwd = os.getcwd()
    try:
        with tempfile.TemporaryDirectory() as tmp:
            os.chdir(tmp)
            for name, content in files.items():
                safe_name = os.path.basename(str(name))
                with _REAL_OPEN(os.path.join(tmp, safe_name), "w", encoding="utf-8", newline="") as fh:
                    fh.write(str(content))
            result = execute_code(code, inputs, sandbox_dir=tmp)
            outputs = {}
            for name in read_files:
                safe_name = os.path.basename(str(name))
                try:
                    with _REAL_OPEN(os.path.join(tmp, safe_name), "r", encoding="utf-8") as fh:
                        outputs[str(name)] = fh.read().replace("\r\n", "\n")
                except FileNotFoundError:
                    outputs[str(name)] = None
            result["files"] = outputs
            return result
    finally:
        os.chdir(old_cwd)


def test_function(code, function_name, args):
    analysis = analyze_code(code)
    if not analysis["ok"]:
        return {"ok": False, "error": analysis["error"], "actual": None, "ast": None}

    # Nem __main__ néven futtatjuk a definíciós fájlt, ezért a szabványos
    # if __name__ == "__main__": blokk nem indul el a függvényteszt előtt.
    with tempfile.TemporaryDirectory() as tmp:
        ns, _ = _build_namespace([], "__student_test__", tmp)
        out = io.StringIO()
        err = io.StringIO()
        try:
            compiled = compile(code, "<student>", "exec")
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                exec(compiled, ns, ns)
            fn = ns.get(function_name)
            if not callable(fn):
                return {
                    "ok": False,
                    "error": {"type": "MissingFunction", "message": f"Nem található a(z) {function_name}() függvény.", "line": None, "text": ""},
                    "actual": None,
                    "ast": analysis["summary"],
                }
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                result = fn(*args)
            return {
                "ok": True,
                "error": None,
                "actual": _jsonable(result),
                "ast": analysis["summary"],
            }
        except BaseException as exc:
            return {
                "ok": False,
                "error": _format_error(exc),
                "actual": None,
                "ast": analysis["summary"],
            }


def handle_request(payload_json):
    payload = _JSON_LOADS(payload_json)
    action = payload.get("action")
    if action == "analyze":
        return _JSON_DUMPS(analyze_code(payload.get("code", "")), ensure_ascii=False)
    if action == "execute":
        result = execute_code(payload.get("code", ""), payload.get("inputs", []))
        return _JSON_DUMPS(result, ensure_ascii=False)
    if action == "executeWithFiles":
        result = execute_code_with_files(
            payload.get("code", ""),
            payload.get("inputs", []),
            payload.get("files", {}),
            payload.get("readFiles", []),
        )
        return _JSON_DUMPS(result, ensure_ascii=False)
    if action == "functionTest":
        result = test_function(
            payload.get("code", ""),
            payload.get("functionName", ""),
            payload.get("args", []),
        )
        return _JSON_DUMPS(result, ensure_ascii=False)
    return _JSON_DUMPS({"ok": False, "error": {"type": "BadRequest", "message": "Ismeretlen művelet.", "line": None, "text": ""}}, ensure_ascii=False)
