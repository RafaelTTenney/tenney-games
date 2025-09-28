function guessPin8DigitUpDown(checkPinFunc) {
  let low = 0, high = 99999999;
  while (low <= high) {
    let pinStr = low.toString().padStart(8, '0');
    if (checkPinFunc(pinStr)) {
      console.log(`PIN found: ${pinStr}`);
      return pinStr;
    }
    if (low !== high) {
      pinStr = high.toString().padStart(8, '0');
      if (checkPinFunc(pinStr)) {
        console.log(`PIN found: ${pinStr}`);
        return pinStr;
      }
    }
    low += 1;
    high -= 1;
  }
  console.log("PIN not found.");
  return null;
}
