"use strict";

const REF_NUMBER_MULTIPLIERS = [7, 3, 1],
  FINNISH_REF_NUMBER_REGEX = /^(\d{4,20}|RF\d{6,22})$/i,
  FINNISH_IBAN_REGEX = /^FI\d{16}$/,
  FINNISH_VIRTUAL_BAR_CODE_REGEX = /^[45]\d{53}$/,
  FINNISH_DATE_REGEX = /^(\d\d?)\.(\d\d?)\.(\d{4})$/,
  IBAN_OFFSET_FROM_ASCIICODE = -55;

function removeAllWhiteSpaces(str) {
  return str.replace(/\s+/g, "");
}

function removeLeadingZeros(str) {
  return str.replace(/^0+/, "");
}

function lettersToNumbers(str) {
  return [...str]
    .map((char) => {
      if (/\D/.test(char)) {
        return String(char.charCodeAt(0) + IBAN_OFFSET_FROM_ASCIICODE);
      }
      return char;
    })
    .join("");
}

function reverseString(str) {
  return [...str].reverse().join("");
}

function removeStringFromEnd(str, strToRemove) {
  if (str.substr(-strToRemove.length) === strToRemove) {
    return str.substr(0, str.length - strToRemove.length);
  }
  return str;
}

function leftPadString(str, char, pad) {
  return (char.repeat(pad) + str).substr(-Math.max(str.length, pad));
}

function randomNumberWithLength(length) {
  let randomNumber = "";
  for (let i = 0; i < length; i++) {
    randomNumber += Math.floor(Math.random() * 9) + 1; // 1...9, because a real number can't begin with zero
  }
  return parseInt(randomNumber, 10);
}

/** JS number type can't handle the long account numbers... */
function modForLargeNumber(base, divisor) {
  let dividend = "";
  for (let i = 0; i < base.length; i++) {
    dividend = parseInt(dividend + base[i], 10);
    if (dividend >= divisor) {
      const remainder = dividend % divisor;
      if (i == base.length - 1) {
        return remainder;
      } else {
        dividend = remainder;
      }
    }
  }
  return parseInt(dividend, 10);
}

/** Luhn mod 10 checksum algorithm https://en.wikipedia.org/wiki/Luhn_algorithm */
function luhnMod10(value) {
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const multiplier = i % 2 === 0 ? 2 : 1;
    let add = multiplier * parseInt(value[i], 10);
    if (add >= 10) {
      add -= 9;
    }
    sum += add;
  }
  const mod10 = sum % 10;
  return mod10 === 0 ? mod10 : 10 - mod10;
}

function isValidFinnishBBAN(accountNumber) {
  accountNumber = removeAllWhiteSpaces(accountNumber);
  const localAccountNumberWithoutCheckSum = accountNumber.substr(4, 13),
    luhnChecksumChar = parseInt(accountNumber.substr(17, 1), 10);

  return luhnMod10(localAccountNumberWithoutCheckSum) === luhnChecksumChar;
}

function isValidIBAN(iban) {
  iban = removeAllWhiteSpaces(iban.toUpperCase());
  const prefixAndChecksum = iban.substr(0, 4),
    number = iban.substr(4);

  return (
    modForLargeNumber(lettersToNumbers(number + prefixAndChecksum), 97) === 1
  );
}

function isValidFinnishDate(string) {
  if (
    !string ||
    typeof string != "string" ||
    !FINNISH_DATE_REGEX.test(string)
  ) {
    return false;
  }

  const [day, month, year] = string
      .match(FINNISH_DATE_REGEX)
      .slice(1, 4)
      .map(Number),
    date = new Date(year, month - 1, day);

  return (
    year == date.getFullYear() &&
    month - 1 == date.getMonth() &&
    day == date.getDate()
  );
}

function sliceVirtualBarCode(barCode) {
  const version = Number(barCode.substr(0, 1));
  let slices;
  if (version === 4) {
    slices = [1, 16, 6, 2, 3, 20, 2, 2, 2];
  } else if (version === 5) {
    slices = [1, 16, 6, 2, 0, 23, 2, 2, 2];
  }
  let index = 0;
  return slices.map((length) => {
    const slice = barCode.substr(index, length);
    index += length;
    return slice;
  });
}

/**
 * Validate parameter given Finnish banking reference number.
 * Allows grouping of numbers with whitespace.
 * @param refNumber - {String} Reference number to parse, for example: 1234 56789 123123
 * @returns {boolean}
 */
function isValidFinnishRefNumber(refNumber) {
  //  Sanity and format check, which allows to make safe assumptions on the format.
  if (
    !refNumber ||
    typeof refNumber !== "string" ||
    !FINNISH_REF_NUMBER_REGEX.test(
      removeAllWhiteSpaces(refNumber.toUpperCase())
    )
  ) {
    return false;
  }

  refNumber = removeAllWhiteSpaces(refNumber.toUpperCase());

  if (/^RF/.test(refNumber)) {
    if (!isValidIBAN(refNumber)) {
      return false;
    }
    refNumber = refNumber.substr(4);
  } else {
    refNumber = removeLeadingZeros(refNumber);
  }

  const reversedRefNumber = reverseString(refNumber),
    providedChecksumNumber = parseInt(reversedRefNumber.charAt(0));

  refNumber = reversedRefNumber.substr(1);

  let checksum = 0,
    checksumNumber;

  for (let i = 0; i < refNumber.length; i++) {
    checksum +=
      REF_NUMBER_MULTIPLIERS[i % REF_NUMBER_MULTIPLIERS.length] *
      parseInt(refNumber.charAt(i));
  }

  checksumNumber = 10 - (checksum % 10);

  if (checksumNumber === 10) {
    checksumNumber = 0;
  }

  return checksumNumber === providedChecksumNumber;
}

/**
 * Validate Finnish IBAN. Allows grouping of numbers with whitespace.
 *
 * @param accountNumber - {String} Account number to validate: FI 90 800026 2776 1348
 * @returns {boolean}
 */
function isValidFinnishIBAN(accountNumber) {
  if (
    !accountNumber ||
    typeof accountNumber !== "string" ||
    !FINNISH_IBAN_REGEX.test(removeAllWhiteSpaces(accountNumber.toUpperCase()))
  ) {
    return false;
  }

  return isValidFinnishBBAN(accountNumber) && isValidIBAN(accountNumber);
}

/**
 * Format Finnish reference number. Adds whitespace every 5 or 4 characters
 *
 * @param refNumber - {String} Reference number to format: RF341234561
 * @param separator - {String} Whitespace or other string to be used
 * @returns {string|undefined}
 */
function formatFinnishRefNumber(refNumber, separator = " ") {
  if (isValidFinnishRefNumber(refNumber)) {
    refNumber = removeAllWhiteSpaces(refNumber.toUpperCase());
    if (/^RF/.test(refNumber)) {
      refNumber =
        refNumber.substr(0, 4) + removeLeadingZeros(refNumber.substr(4));
      return removeStringFromEnd(
        refNumber.replace(/.{4}/g, "$&" + separator),
        separator
      );
    } else {
      refNumber = removeLeadingZeros(refNumber);
      return reverseString(
        removeStringFromEnd(
          reverseString(refNumber).replace(/.{5}/g, "$&" + separator),
          separator
        )
      );
    }
  }
}

/**
 * Format Finnish IBAN. Adds whitespace every 4 characters
 *
 * @param accountNumber - {String} Account number to format: FI9080002627761348
 * @param separator - {String} Whitespace or other string to be used
 * @returns {string|undefined}
 */
function formatFinnishIBAN(accountNumber, separator = " ") {
  if (isValidFinnishIBAN(accountNumber)) {
    accountNumber = removeAllWhiteSpaces(accountNumber.toUpperCase());
    return removeStringFromEnd(
      accountNumber.replace(/.{4}/g, "$&" + separator),
      separator
    );
  }
}

/**
 * Returns a reference number including checksum char. If no initial string
 * is given, will use a random 9 char string instead.
 * Will not preserve whitespace in the initial string.
 * @param {String} initial - Initial string to calculate checksum for
 * @returns {String} - For example '1776750586'
 */
function generateFinnishRefNumber(initial) {
  const refNumber =
      typeof initial === "string"
        ? removeAllWhiteSpaces(initial)
        : randomNumberWithLength(9).toString(),
    reversedRefNumber = reverseString(refNumber);

  let checksum = 0,
    checksumNumber;

  for (let i = 0; i < reversedRefNumber.length; i++) {
    checksum +=
      REF_NUMBER_MULTIPLIERS[i % REF_NUMBER_MULTIPLIERS.length] *
      parseInt(reversedRefNumber.charAt(i));
  }

  checksumNumber = 10 - (checksum % 10);

  if (checksumNumber === 10) {
    checksumNumber = 0;
  }

  return refNumber + checksumNumber;
}

/**
 * Returns a semi-random valid Finnish Iban bank account number
 * https://en.wikipedia.org/wiki/International_Bank_Account_Number#Generating_IBAN_check_digits
 * @returns {string} IBAN string, for example FI9080002627761348
 */
function generateFinnishIBAN() {
  const defaultCheckDigit = "00",
    danskeBankOffice = "800026", //  Use a real bank and office for simplicity
    countryCodeInDigits = lettersToNumbers("FI"),
    bankAccount = randomNumberWithLength(7),
    localAccountNumber =
      danskeBankOffice +
      bankAccount +
      luhnMod10(danskeBankOffice + bankAccount),
    accountNumberCandidate =
      localAccountNumber + countryCodeInDigits + defaultCheckDigit,
    checkDigit = 98 - modForLargeNumber(accountNumberCandidate, 97),
    checkChars = checkDigit >= 10 ? checkDigit.toString() : "0" + checkDigit;

  return "FI" + checkChars + localAccountNumber;
}

/**
 * Parse Finnish virtual bar code (aka virtuaaliviivakoodi, pankkiviidakoodi).
 * Supports versions 4 and 5
 * Based on: http://www.finanssiala.fi/maksujenvalitys/dokumentit/Pankkiviivakoodi-opas.pdf
 *
 * @param barCode - {String} Bar code to parse: 458101710000001220004829900000000559582243294671120131
 * @returns {object|false}
 */
function parseFinnishVirtualBarCode(barCode) {
  if (
    !barCode ||
    typeof barCode != "string" ||
    !FINNISH_VIRTUAL_BAR_CODE_REGEX.test(barCode)
  ) {
    return false;
  }

  let [version, iban, euros, cents, reserve, reference, year, month, day] =
    sliceVirtualBarCode(barCode);

  version = Number(version);

  iban = formatFinnishIBAN("FI" + iban);
  const sum = Number(euros) + Number(cents) / 100;

  if (version === 5) {
    reference =
      "RF" + reference.substr(0, 2) + removeLeadingZeros(reference.substr(2));
  }
  reference = formatFinnishRefNumber(reference);

  let date;
  day = Number(day);
  month = Number(month);
  if (day > 0 && month > 0) {
    date = `${day}.${month}.20${year}`;
  }

  return { iban, sum, reference, date };
}

/**
 * Formats Finnish virtual bar code
 * Supports versions 4 and 5
 * Based on: http://www.finanssiala.fi/maksujenvalitys/dokumentit/Pankkiviivakoodi-opas.pdf
 *
 * @param object - {Object} Parameters
 * @returns {string|false}
 */
function formatFinnishVirtualBarCode(object) {
  if (!object) {
    console.log("Object is null or undefined");
    return false;
  }

  if (typeof object != "object") {
    console.log("Object is not of type object");
    return false;
  }

  if (!isValidFinnishIBAN(object.iban)) {
    console.log("Invalid Finnish IBAN");
    return false;
  }

  if (typeof object.sum != "number") {
    console.log("Sum is not a number");
    return false;
  }

  if (object.sum < 0) {
    console.log("Sum is less than 0");
    return false;
  }

  if (object.sum > 999999.99) {
    console.log("Sum is greater than 999999.99");
    return false;
  }

  if (object.sum != Number(object.sum.toFixed(2))) {
    console.log("Sum is not a valid decimal number with 2 decimal places");
    return false;
  }

  if (!isValidFinnishRefNumber(object.reference)) {
    console.log("Invalid Finnish reference number");
    return false;
  }

  if (object.date != undefined && !isValidFinnishDate(object.date)) {
    console.log("Invalid Finnish date");
    return false;
  }

  let iban = removeAllWhiteSpaces(object.iban),
    euros = Math.floor(object.sum),
    cents = Math.floor(object.sum * 100 - euros * 100),
    reference = removeAllWhiteSpaces(object.reference),
    day = 0,
    month = 0,
    year = 0,
    version = /^RF/.test(reference) ? 5 : 4;

  if (object.date) {
    [day, month, year] = object.date
      .match(FINNISH_DATE_REGEX)
      .slice(1, 4)
      .map(Number);
  }

  if (version == 5) {
    reference = reference.replace(/^RF/, "");
    reference =
      reference.substr(0, 2) + leftPadString(reference.substr(2), "0", 21);
  }

  return (
    String(version) +
    iban.replace(/^FI/, "") +
    leftPadString(String(euros), "0", 6) +
    leftPadString(String(cents), "0", 2) +
    leftPadString(reference, "0", 23) +
    leftPadString(String(year).substr(-2), "0", 2) +
    leftPadString(String(month), "0", 2) +
    leftPadString(String(day), "0", 2)
  );
}
