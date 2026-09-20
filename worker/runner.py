import ast
import builtins
import contextlib
import io
import json
import traceback
from collections import Counter, deque

# A tanulói kód külön névtérben fut, de ugyanabban a Python interpreterben.
# Ezeket a referenciákat induláskor elmentjük, hogy egy tanulói monkeypatch
# (pl. json.dumps felülírása) ne tudja az ellenőrző válaszát módosítani.
_JSON_DUMPS = json.dumps
_JSON_LOADS = json.loads
_REAL_IMPORT = builtins.__import__

BLOCKED_IMPORT_ROOTS = {"js", "pyodide", "micropip", "__main__", "builtins"}


def _jsonable(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    return repr(value)


def analyze_code(code):
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

    nodes = Counter()
    calls = Counter()
    ops = Counter()
    functions = {}

    for node in ast.walk(tree):
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


def _safe_builtins(fake_input):
    data = dict(vars(builtins))

    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        root = name.split(".", 1)[0]
        if root in BLOCKED_IMPORT_ROOTS:
            raise ImportError(f"A(z) {root} modul ebben a gyakorlókörnyezetben nem használható.")
        return _REAL_IMPORT(name, globals, locals, fromlist, level)

    data["input"] = fake_input
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


def _build_namespace(inputs, module_name="__main__"):
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
        "__builtins__": _safe_builtins(fake_input),
    }
    return ns, consumed


def execute_code(code, inputs=None):
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

    ns, consumed = _build_namespace(inputs, "__main__")
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


def test_function(code, function_name, args):
    analysis = analyze_code(code)
    if not analysis["ok"]:
        return {"ok": False, "error": analysis["error"], "actual": None, "ast": None}

    # Nem __main__ néven futtatjuk a definíciós fájlt, ezért a szabványos
    # if __name__ == "__main__": blokk nem indul el a függvényteszt előtt.
    ns, _ = _build_namespace([], "__student_test__")
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
    if action == "functionTest":
        result = test_function(
            payload.get("code", ""),
            payload.get("functionName", ""),
            payload.get("args", []),
        )
        return _JSON_DUMPS(result, ensure_ascii=False)
    return _JSON_DUMPS({"ok": False, "error": {"type": "BadRequest", "message": "Ismeretlen művelet.", "line": None, "text": ""}}, ensure_ascii=False)
