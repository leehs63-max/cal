window.Calc = (() => {
  'use strict';

  // Token type tags
  const N = 'N'; // number
  const I = 'I'; // function identifier
  const C = 'C'; // constant (π, e)
  const O = 'O'; // binary operator
  const U = 'U'; // unary negation
  const P = 'P'; // postfix (!, %)
  const L = 'L'; // (
  const R = 'R'; // )

  const FUNC_NAMES = ['asin','acos','atan','sqrt','sin','cos','tan','log','ln'];

  const OP_PREC  = { '+':1, '−':1, '×':2, '÷':2, '^':3 };
  const OP_ASSOC = { '+':'L','−':'L','×':'L','÷':'L','^':'R' };

  // ── Tokenizer ────────────────────────────────────────────
  function tokenize(str) {
    const tok = [];
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === ' ') { i++; continue; }

      if (/[0-9.]/.test(ch)) {
        let s = '';
        while (i < str.length && /[0-9.]/.test(str[i])) s += str[i++];
        tok.push({ t: N, v: parseFloat(s) });
        continue;
      }

      if (ch === 'π') { tok.push({ t: C, n: 'π' }); i++; continue; }

      if (/[a-z]/.test(ch)) {
        let name = '';
        while (i < str.length && /[a-z]/.test(str[i])) name += str[i++];
        if (FUNC_NAMES.includes(name)) tok.push({ t: I, n: name });
        else if (name === 'e') tok.push({ t: C, n: 'e' });
        else throw new Error('Unknown: ' + name);
        continue;
      }

      if ('+-−×÷^*/'.includes(ch)) {
        const map = { '*': '×', '/': '÷', '-': '−' };
        tok.push({ t: O, n: map[ch] || ch });
        i++; continue;
      }

      if (ch === '!') { tok.push({ t: P, n: '!' }); i++; continue; }
      if (ch === '%') { tok.push({ t: P, n: '%' }); i++; continue; }
      if (ch === '(') { tok.push({ t: L }); i++; continue; }
      if (ch === ')') { tok.push({ t: R }); i++; continue; }

      throw new Error('Unknown char: ' + ch);
    }
    return tok;
  }

  // ── Implicit multiplication ──────────────────────────────
  function implicitMul(toks) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      out.push(toks[i]);
      if (i + 1 < toks.length) {
        const cur  = toks[i];
        const next = toks[i + 1];
        const isVal   = cur.t  === N || cur.t  === R || cur.t  === C || cur.t  === P;
        const isStart = next.t === I || next.t === C || next.t === L || next.t === N;
        if (isVal && isStart) out.push({ t: O, n: '×' });
      }
    }
    return out;
  }

  // ── Unary minus detection ────────────────────────────────
  // UNEG behaves as prec=3 right-assoc so that -2^2 = -(2^2) = -4
  function markUnary(toks) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i];
      if (tok.t === O && (tok.n === '−' || tok.n === '+')) {
        const prev = toks[i - 1];
        const isUnary = !prev || prev.t === O || prev.t === L || prev.t === I;
        if (isUnary) {
          if (tok.n === '−') out.push({ t: U });
          // unary + is dropped
          continue;
        }
      }
      out.push(tok);
    }
    return out;
  }

  // ── Shunting-Yard ─────────────────────────────────────────
  function shouldPop(top, curP, curA) {
    if (top.t === I) return true;                                              // functions always pop
    if (top.t === U) return 3 > curP || (3 === curP && curA === 'L');         // UNEG acts as prec-3 right-assoc
    if (top.t === O) return OP_PREC[top.n] > curP || (OP_PREC[top.n] === curP && curA === 'L');
    return false;
  }

  function shunt(toks) {
    const out = [], stack = [];
    const top   = () => stack[stack.length - 1];
    const popTo = () => out.push(stack.pop());

    for (const tok of toks) {
      if (tok.t === N || tok.t === C) {
        out.push(tok);
      } else if (tok.t === I) {
        stack.push(tok);
      } else if (tok.t === O) {
        const p = OP_PREC[tok.n], a = OP_ASSOC[tok.n];
        while (stack.length && top().t !== L && shouldPop(top(), p, a)) popTo();
        stack.push(tok);
      } else if (tok.t === U) {
        // UNEG prec=3 right-assoc: only pop higher-prec items (= functions)
        while (stack.length && top().t !== L && top().t === I) popTo();
        stack.push(tok);
      } else if (tok.t === P) {
        out.push(tok); // postfix goes straight to output
      } else if (tok.t === L) {
        stack.push(tok);
      } else if (tok.t === R) {
        while (stack.length && top().t !== L) popTo();
        if (!stack.length) throw new Error('Mismatched )');
        stack.pop(); // discard (
        if (stack.length && top().t === I) popTo(); // emit function
      }
    }

    while (stack.length) {
      if (top().t === L) throw new Error('Mismatched (');
      popTo();
    }

    return out;
  }

  // ── RPN Evaluator ─────────────────────────────────────────
  const CONSTS = { 'π': Math.PI, 'e': Math.E };

  function evalRPN(rpn, angleMode) {
    const toRad   = x => angleMode === 'deg' ? x * Math.PI / 180 : x;
    const fromRad = x => angleMode === 'deg' ? x * 180 / Math.PI : x;

    const FUNCS = {
      sin:  x => Math.sin(toRad(x)),
      cos:  x => Math.cos(toRad(x)),
      tan:  x => Math.tan(toRad(x)),
      asin: x => fromRad(Math.asin(x)),
      acos: x => fromRad(Math.acos(x)),
      atan: x => fromRad(Math.atan(x)),
      sqrt: x => x < 0 ? NaN : Math.sqrt(x),
      log:  x => Math.log10(x),
      ln:   x => Math.log(x),
    };

    const stack = [];
    for (const tok of rpn) {
      if      (tok.t === N) { stack.push(tok.v); }
      else if (tok.t === C) { stack.push(CONSTS[tok.n]); }
      else if (tok.t === I) {
        const fn = FUNCS[tok.n];
        if (!fn) throw new Error('Unknown fn: ' + tok.n);
        stack.push(fn(stack.pop()));
      }
      else if (tok.t === U) { stack.push(-stack.pop()); }
      else if (tok.t === O) {
        const b = stack.pop(), a = stack.pop();
        switch (tok.n) {
          case '+': stack.push(a + b); break;
          case '−': stack.push(a - b); break;
          case '×': stack.push(a * b); break;
          case '÷': stack.push(b === 0 ? Infinity : a / b); break;
          case '^': stack.push(Math.pow(a, b)); break;
        }
      }
      else if (tok.t === P) {
        const x = stack.pop();
        if (tok.n === '!') {
          const n = Math.round(x);
          if (n < 0 || n > 170) { stack.push(Infinity); }
          else { let f = 1; for (let k = 2; k <= n; k++) f *= k; stack.push(f); }
        } else if (tok.n === '%') {
          stack.push(x / 100);
        }
      }
    }

    if (stack.length !== 1) throw new Error('Invalid expression');
    return stack[0];
  }

  // ── Result formatter ─────────────────────────────────────
  function fmt(n) {
    if (isNaN(n) || !isFinite(n) || Math.abs(n) > 1e15) return 'Error';
    return String(parseFloat(n.toPrecision(10)));
  }

  // ── Public API ────────────────────────────────────────────
  function evaluate(str, angleMode = 'deg') {
    if (!str.trim()) return '0';
    // Auto-close unmatched opening parens
    const opens  = (str.match(/\(/g) || []).length;
    const closes = (str.match(/\)/g) || []).length;
    if (opens > closes) str += ')'.repeat(opens - closes);

    const toks = markUnary(implicitMul(tokenize(str)));
    const rpn  = shunt(toks);
    return fmt(evalRPN(rpn, angleMode));
  }

  return { evaluate };
})();
