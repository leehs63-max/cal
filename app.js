const elResult = document.getElementById('resultLine');
const elExpr   = document.getElementById('exprLine');
const elCalc   = document.querySelector('.calculator');

let expr       = '';
let prevExpr   = '';
let lastAns    = null;
let angleMode  = 'deg';
let justEvaled = false;
let invMode    = false;

// ── Render ───────────────────────────────────────────────
function render() {
  const display = expr || '0';
  elResult.textContent = display;

  const len = display.length;
  elResult.classList.remove('sm', 'xs', 'xxs', 'error');
  if (display === 'Error')  elResult.classList.add('error');
  else if (len > 24)        elResult.classList.add('xxs');
  else if (len > 16)        elResult.classList.add('xs');
  else if (len > 10)        elResult.classList.add('sm');

  elExpr.textContent = justEvaled && prevExpr ? prevExpr + ' =' : ' ';

  // Mode toggles
  document.getElementById('btnRad').classList.toggle('active', angleMode === 'rad');
  document.getElementById('btnDeg').classList.toggle('active', angleMode === 'deg');
  document.getElementById('btnInv').classList.toggle('active', invMode);

  // INV labels
  document.querySelectorAll('[data-inv-func],[data-inv-insert]').forEach(btn => {
    btn.textContent = invMode ? btn.dataset.invLabel : btn.dataset.label;
  });
}

// ── Editor ───────────────────────────────────────────────
const FUNC_TAILS = ['asin(','acos(','atan(','sqrt(','sin(','cos(','tan(','log(','ln('];

function append(str) {
  if (justEvaled) {
    const isOp = /^[+−×÷^]/.test(str);
    if (!isOp) expr = '';
    justEvaled = false;
  }
  expr += str;
}

function appendDecimal() {
  const trailing = (expr.match(/[0-9.]*$/) || [''])[0];
  if (trailing.includes('.')) return;
  const last = expr.slice(-1);
  append(!expr || /[+−×÷^(]/.test(last) ? '0.' : '.');
}

function backspace() {
  if (justEvaled) { clearAll(); return; }
  if (expr === 'Error') { expr = ''; return; }
  const tail = FUNC_TAILS.find(t => expr.endsWith(t));
  expr = tail ? expr.slice(0, -tail.length) : expr.slice(0, -1);
}

function clearAll() {
  expr = ''; prevExpr = ''; justEvaled = false;
}

function evaluate() {
  if (!expr || expr === 'Error') return;
  try {
    prevExpr   = expr;
    expr       = Calc.evaluate(expr, angleMode);
    if (expr !== 'Error') lastAns = expr;
    justEvaled = true;
  } catch {
    prevExpr = expr; expr = 'Error'; justEvaled = true;
  }
}

// ── Button clicks ────────────────────────────────────────
elCalc.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const { digit, operator, action } = btn.dataset;
  const constVal = btn.dataset['const'];

  // INV-capable buttons: invInsert takes priority over invFunc
  const useInv     = invMode && (btn.dataset.invInsert || btn.dataset.invFunc);
  const invInsert  = btn.dataset.invInsert;
  const invFunc    = btn.dataset.invFunc;
  const normalFunc = btn.dataset.func;

  if (digit !== undefined) {
    append(digit);
  } else if (operator !== undefined) {
    append(operator);
  } else if (useInv) {
    invInsert ? append(invInsert) : append(invFunc + '(');
  } else if (normalFunc !== undefined) {
    append(normalFunc + '(');
  } else if (constVal !== undefined) {
    append(constVal);
  } else if (action) {
    switch (action) {
      case 'clear':      clearAll();                                   break;
      case 'backspace':  backspace();                                   break;
      case 'decimal':    appendDecimal();                               break;
      case 'equals':     evaluate();                                    break;
      case 'factorial':  append('!');                                   break;
      case 'power':      append('^');                                   break;
      case 'openParen':  append('(');                                   break;
      case 'closeParen': append(')');                                   break;
      case 'insertExp':  append('×10^');                                break;
      case 'ans':        if (lastAns !== null) append(String(lastAns)); break;
      case 'setRad':     angleMode = 'rad';                             break;
      case 'setDeg':     angleMode = 'deg';                             break;
      case 'toggleInv':  invMode = !invMode;                            break;
    }
  }

  render();
});

// ── Keyboard ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) return;
  let handled = true;

  switch (e.key) {
    case '0': case '1': case '2': case '3': case '4':
    case '5': case '6': case '7': case '8': case '9': append(e.key); break;
    case '.': appendDecimal(); break;
    case '+': append('+'); break;
    case '-': append('−'); break;
    case '*': append('×'); break;
    case '/': e.preventDefault(); append('÷'); break;
    case '^': append('^'); break;
    case '(': append('('); break;
    case ')': append(')'); break;
    case '!': append('!'); break;
    case '%': append('%'); break;
    case 'p': append('π'); break;
    case 'e': append('e'); break;
    case 's': append('sin('); break;
    case 'c': append('cos('); break;
    case 't': append('tan('); break;
    case 'r': append('sqrt('); break;
    case 'l': append('log('); break;
    case 'n': append('ln('); break;
    case 'd': angleMode = angleMode === 'deg' ? 'rad' : 'deg'; break;
    case 'Enter': case '=': evaluate(); break;
    case 'Escape': clearAll(); break;
    case 'Backspace': backspace(); break;
    default: handled = false;
  }

  if (handled) render();
});

render();
