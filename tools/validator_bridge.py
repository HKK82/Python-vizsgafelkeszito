import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'worker'))
import runner  # noqa: E402


def comparison_count(summary):
    return sum(int(summary.get('ops', {}).get(name, 0)) for name in ('Lt','LtE','Gt','GtE','Eq','NotEq'))


def check_req(summary, r):
    minimum = r.get('min', 1)
    typ = r.get('type')
    name = r.get('name')
    if typ == 'node':
        return int(summary.get('nodes', {}).get(name, 0)) >= minimum
    if typ == 'call':
        return int(summary.get('calls', {}).get(name, 0)) >= minimum
    if typ == 'op':
        return int(summary.get('ops', {}).get(name, 0)) >= minimum
    if typ == 'rangeCondition':
        return int(summary.get('ops', {}).get('And', 0)) >= 1 or comparison_count(summary) >= 2
    if typ == 'listAdd':
        return int(summary.get('calls', {}).get('append', 0)) >= minimum or int(summary.get('ops', {}).get('Add', 0)) >= minimum
    if typ == 'function':
        argc = summary.get('functions', {}).get(name)
        return isinstance(argc, int) and argc >= r.get('minArgs', 0)
    return True


def validate_case(task, code):
    analysis = runner.analyze_code(code)
    if not analysis.get('ok'):
        return False
    summary = analysis.get('summary', {})
    if any(not check_req(summary, r) for r in task.get('checks', [])):
        return False
    for t in task.get('tests', []):
        res = runner.execute_code(code, t.get('inputs', []))
        if not res.get('ok') or res.get('stdoutLines', []) != [str(x) for x in t.get('expectedLines', [])]:
            return False
    for t in task.get('functionTests', []):
        res = runner.test_function(code, t.get('functionName', ''), t.get('args', []))
        if not res.get('ok') or res.get('actual') != t.get('expected'):
            return False
    return True


def main():
    payload = json.load(sys.stdin)
    cases = payload.get('cases', [])
    result = [validate_case(c.get('task', {}), c.get('code', '')) for c in cases]
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == '__main__':
    main()
