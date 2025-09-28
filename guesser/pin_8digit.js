function guessPin8Digit(checkPinFunc) {
  for (let pin = 0; pin < 100000000; pin++) {
    const pinStr = pin.toString().padStart(8, '0');
    if (checkPinFunc(pinStr)) {
      console.log(`PIN found: ${pinStr}`);
      return pinStr;
    }
  }
  console.log("PIN not found.");
  return null;
}
