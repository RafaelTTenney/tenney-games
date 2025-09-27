function guessPin4Digit(checkPinFunc) {
  for (let pin = 0; pin < 10000; pin++) {
    const pinStr = pin.toString().padStart(4, '0');
    if (checkPinFunc(pinStr)) {
      console.log(`PIN found: ${pinStr}`);
      return pinStr;
    }
  }
  console.log("PIN not found.");
  return null;
}
