// Caret behaviour of the Saldo awal field (PR #33).
//
// FakeInput models what a browser does to an <input> on each edit (insert at
// the selection, Backspace, Delete, paste, select all) and reports the same
// value, selectionEnd, and inputType that AccountForm's onChange reads. The
// form then calls applyOpeningBalanceEdit and moves the caret, as
// handleBalanceChange + the layout effect do. No database, no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyOpeningBalanceEdit,
  caretAfterDigits,
  formatOpeningBalanceInput,
  parseOpeningBalanceInput,
} from "../lib/opening-balance-input.ts";

class FakeInput {
  constructor(value = "") {
    this.value = value;
    this.start = value.length;
    this.end = value.length;
  }

  // Caret marked with "|" in the value, e.g. "Rp 12|3.133".
  static at(marked) {
    const input = new FakeInput(marked.replace("|", ""));
    input.start = input.end = marked.indexOf("|");
    return input;
  }

  select(start, end) {
    this.start = start;
    this.end = end;
    return this;
  }

  selectAll() {
    return this.select(0, this.value.length);
  }

  // The browser edit, then the form's onChange handling.
  #edit(nextValue, caret, inputType) {
    const previous = this.value;
    const edit = applyOpeningBalanceEdit(previous, nextValue, caret, inputType);
    this.value = edit.value;
    this.start = this.end = edit.caret;
    return this;
  }

  type(text) {
    for (const ch of text) {
      const next = this.value.slice(0, this.start) + ch + this.value.slice(this.end);
      this.#edit(next, this.start + 1, "insertText");
    }
    return this;
  }

  paste(text) {
    const next = this.value.slice(0, this.start) + text + this.value.slice(this.end);
    return this.#edit(next, this.start + text.length, "insertFromPaste");
  }

  backspace() {
    if (this.start !== this.end) {
      return this.#edit(this.value.slice(0, this.start) + this.value.slice(this.end), this.start, "deleteContentBackward");
    }
    if (this.start === 0) return this;
    const next = this.value.slice(0, this.start - 1) + this.value.slice(this.start);
    return this.#edit(next, this.start - 1, "deleteContentBackward");
  }

  delete() {
    if (this.start !== this.end) {
      return this.#edit(this.value.slice(0, this.start) + this.value.slice(this.end), this.start, "deleteContentForward");
    }
    if (this.start === this.value.length) return this;
    const next = this.value.slice(0, this.start) + this.value.slice(this.start + 1);
    return this.#edit(next, this.start, "deleteContentForward");
  }

  // Value with the caret marked, for readable assertions.
  get marked() {
    return this.value.slice(0, this.end) + "|" + this.value.slice(this.end);
  }
}

test("typing a number normally formats it with the caret at the end", () => {
  const input = new FakeInput().type("123133");
  assert.equal(input.marked, "Rp 123.133|");
  assert.equal(new FakeInput().type("1234567890").marked, "Rp 1.234.567.890|");
});

test("inserting a digit in the middle keeps the caret right after it", () => {
  assert.equal(FakeInput.at("Rp 12|3.133").type("9").marked, "Rp 1.29|3.133");
  assert.equal(FakeInput.at("Rp 1|.000").type("5").marked, "Rp 15|.000");
  assert.equal(FakeInput.at("Rp |500").type("2").marked, "Rp 2|.500");
});

test("several keystrokes in the middle are not lost or reordered", () => {
  const input = FakeInput.at("Rp 1|.000").type("234");
  assert.equal(input.marked, "Rp 1.234|.000");
  assert.equal(parseOpeningBalanceInput(input.value), 1234000);
});

test("Backspace on a middle digit removes that digit and keeps the caret there", () => {
  assert.equal(FakeInput.at("Rp 123.1|33").backspace().marked, "Rp 12.3|33");
  assert.equal(FakeInput.at("Rp 1.234.5|67").backspace().marked, "Rp 123.4|67");
});

test("Delete on a middle digit removes the digit after the caret", () => {
  assert.equal(FakeInput.at("Rp 12|3.133").delete().marked, "Rp 12|.133");
  assert.equal(FakeInput.at("Rp 1.2|34.567").delete().marked, "Rp 12|4.567");
});

test("Backspace right after a separator deletes the digit before it", () => {
  assert.equal(FakeInput.at("Rp 123.|133").backspace().marked, "Rp 12|.133");
  assert.equal(FakeInput.at("Rp 1.|000").backspace().marked, "Rp |0");
});

test("Delete right before a separator deletes the digit after it", () => {
  assert.equal(FakeInput.at("Rp 123|.133").delete().marked, "Rp 12.3|33");
});

test("crossing a thousands separator while typing moves the caret correctly", () => {
  // 999 -> 9.999: the new separator appears left of the caret.
  assert.equal(FakeInput.at("Rp 999|").type("9").marked, "Rp 9.999|");
  // 1.000 -> 100: deleting the first digit removes the separator.
  assert.equal(FakeInput.at("Rp 1|.000").backspace().marked, "Rp |0");
  assert.equal(FakeInput.at("Rp 10.0|00").backspace().marked, "Rp 1.0|00");
});

test("selecting part of the number and typing replaces it", () => {
  // Select "3.1" in "Rp 123.133" and type 7.
  const input = new FakeInput("Rp 123.133").select(5, 8).type("7");
  assert.equal(input.marked, "Rp 12.7|33");
  assert.equal(parseOpeningBalanceInput(input.value), 12733);
});

test("selecting part of the number and pressing Backspace or Delete removes it", () => {
  assert.equal(new FakeInput("Rp 123.133").select(4, 7).backspace().marked, "Rp 1|.133");
  assert.equal(new FakeInput("Rp 123.133").select(4, 7).delete().marked, "Rp 1|.133");
});

test("select all, then type, replaces the whole value", () => {
  assert.equal(new FakeInput("Rp 123.133").selectAll().type("5").marked, "Rp 5|");
});

test("select all, then Backspace, clears the field; it submits as 0", () => {
  const input = new FakeInput("Rp 123.133").selectAll().backspace();
  assert.equal(input.marked, "|");
  assert.equal(parseOpeningBalanceInput(input.value), 0);
});

test("pasting formatted and unformatted amounts keeps the caret after the pasted digits", () => {
  assert.equal(new FakeInput().paste("Rp 5.000.000").marked, "Rp 5.000.000|");
  assert.equal(new FakeInput().paste("2500000").marked, "Rp 2.500.000|");
  assert.equal(new FakeInput().paste("Rp2.500.000,-").marked, "Rp 2.500.000|");
  assert.equal(FakeInput.at("Rp 1|.000").paste("23").marked, "Rp 123|.000");
  assert.equal(new FakeInput("Rp 999").selectAll().paste("1.250.000").marked, "Rp 1.250.000|");
});

test("typed letters or symbols change nothing and the caret stays put", () => {
  assert.equal(FakeInput.at("Rp 12|3.133").type("a").marked, "Rp 12|3.133");
  assert.equal(FakeInput.at("Rp 12|3.133").type(",").marked, "Rp 12|3.133");
});

test("typing before the Rp prefix or deleting it keeps the number intact", () => {
  assert.equal(FakeInput.at("|Rp 500").type("1").marked, "Rp 1|.500");
  assert.equal(FakeInput.at("Rp |500").backspace().marked, "Rp |500");
  assert.equal(FakeInput.at("|Rp 500").delete().marked, "Rp |500");
});

test("leading zeros are dropped without moving the caret past real digits", () => {
  assert.equal(new FakeInput().type("0").marked, "Rp 0|");
  assert.equal(new FakeInput().type("05").marked, "Rp 5|");
  assert.equal(FakeInput.at("Rp |5").type("0").marked, "Rp |5");
});

test("clearing digit by digit ends with an empty field, never Rp NaN", () => {
  const input = new FakeInput().type("1000");
  for (let i = 0; i < 4; i++) input.backspace();
  assert.equal(input.marked, "|");
  assert.equal(input.value.includes("NaN"), false);
});

test("the submitted number always equals the digits the user ended with", () => {
  const input = new FakeInput().type("5000000");
  input.select(3, 4).type("7"); // 5 -> 7
  FakeInput.prototype.backspace.call(input.select(input.value.length, input.value.length));
  assert.equal(input.value, "Rp 700.000");
  assert.equal(parseOpeningBalanceInput(input.value), 700000);
  for (const n of [0, 7, 1000, 123133, 987654321012, Number.MAX_SAFE_INTEGER]) {
    assert.equal(parseOpeningBalanceInput(new FakeInput().paste(String(n)).value), n);
  }
});

test("a too-large number is kept visible but rejected on submit, as before", () => {
  const input = new FakeInput().paste("9007199254740992");
  assert.equal(input.value, "Rp 9.007.199.254.740.992");
  assert.equal(parseOpeningBalanceInput(input.value), null);
});

test("mobile keyboards without inputType still format and keep the caret", () => {
  // Some Android keyboards report no inputType for composition edits.
  assert.deepEqual(applyOpeningBalanceEdit("Rp 123.133", "Rp 1293.133", 6, undefined), {
    value: "Rp 1.293.133",
    caret: 7,
  });
  // Without inputType a separator-only deletion is not upgraded to a digit
  // deletion; the value and digit position are unchanged, never corrupted.
  assert.deepEqual(applyOpeningBalanceEdit("Rp 123.133", "Rp 123133", 6, undefined), {
    value: "Rp 123.133",
    caret: 6,
  });
});

test("the caret maps by digit count, so separators never shift it", () => {
  const value = "Rp 1.234.567";
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => caretAfterDigits(value, n)),
    [3, 4, 6, 7, 8, 10, 11, 12, 12],
  );
  assert.equal(caretAfterDigits("", 3), 0);
  assert.equal(formatOpeningBalanceInput("Rp 1.234.567"), value);
});

test("the form restores the selection after render without stealing focus", () => {
  const form = readFileSync(new URL("../components/finance/account-form.tsx", import.meta.url), "utf8");
  assert.match(form, /ref=\{balanceRef\}\s*\n\s*value=\{balanceInput\}\s*\n\s*onChange=\{handleBalanceChange\}/);
  assert.match(form, /setBalanceCaret\(\{ position: edit\.caret \}\)/);
  assert.doesNotMatch(form, /setBalanceInput\(formatOpeningBalanceInput\(/);
  assert.match(form, /inputMode="decimal"/);
  assert.match(form, /useLayoutEffect\(/);
  assert.match(form, /document\.activeElement !== input/);
  assert.match(form, /input\.setSelectionRange\(balanceCaret\.position, balanceCaret\.position\)/);
  assert.match(form, /input\.selectionEnd \?\? input\.value\.length/);
  assert.match(form, /\(e\.nativeEvent as InputEvent\)\.inputType/);
  assert.doesNotMatch(form, /\.focus\(\)/);
});

test("typing a comma keeps caret after decimal separator, then the sen", () => {
  const withComma = applyOpeningBalanceEdit("Rp 0", "Rp 0,", 5, "insertText");
  assert.deepEqual(withComma, { value: "Rp 0,", caret: 5 });
  const withSen = applyOpeningBalanceEdit(withComma.value, "Rp 0,4", 6, "insertText");
  assert.deepEqual(withSen, { value: "Rp 0,4", caret: 6 });
  const completed = applyOpeningBalanceEdit(withSen.value, "Rp 0,41", 7, "insertText");
  assert.deepEqual(completed, { value: "Rp 0,41", caret: 7 });
  assert.equal(parseOpeningBalanceInput(completed.value), 0.41);
});

test("pasting a grouped decimal opening balance preserves value and caret", () => {
  const text = "Rp 261.157,41";
  assert.deepEqual(applyOpeningBalanceEdit("", text, text.length, "insertFromPaste"), {
    value: text, caret: text.length,
  });
  assert.equal(parseOpeningBalanceInput(text), 261157.41);
});
