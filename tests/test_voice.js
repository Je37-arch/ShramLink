"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  number,
  parse,
  idDigits,
  STEPS,
} = require("../static/js/voice-assistant.js");
test("Hindi ages and experience use bounded numeric parsing", () => {
  assert.equal(number("मेरी उम्र पच्चीस साल है"), 25);
  assert.equal(number("२६"), 26);
  assert.equal(number("तीन साल का अनुभव है"), 3);
  assert.equal(number("शून्य"), 0);
  assert.equal(number("पांच"), 5);
  assert.equal(number("बीस या तीस"), null);
  assert.equal(number("10000"), null);
});
test("Hindi skill/domain/city aliases map to existing server vocabulary", () => {
  assert.deepEqual(parse("skills", "मुझे वेल्डिंग और बिजली का काम आता है"), [
    "welder",
    "electrician",
  ]);
  assert.deepEqual(parse("skills", "नहीं समझा"), []);
  assert.equal(parse("preferred_domain", "गोदाम"), "warehouse");
  assert.equal(parse("location", "ग्रेटर नोएडा"), "Greater Noida");
  assert.equal(parse("location", "गुड़गांव"), "Gurugram");
  assert.equal(parse("location", "अज्ञात शहर"), null);
});
test("Name cleanup and e-Shram require explicit valid values", () => {
  assert.equal(parse("name", "मेरा नाम परीक्षण श्रमिक है।"), "परीक्षण श्रमिक");
  assert.equal(idDigits("१२३४ ५६७८ ९०१२"), "123456789012");
  assert.equal(
    idDigits("एक दो तीन चार पाँच छह सात आठ नौ शून्य एक दो"),
    "123456789012",
  );
  assert.equal(idDigits("1234 unknown 56789012"), null);
  assert.equal(STEPS.length, 7);
  assert.deepEqual(
    STEPS.filter((s) => s.optional).map((s) => s.key),
    ["eshram_number"],
  );
});
