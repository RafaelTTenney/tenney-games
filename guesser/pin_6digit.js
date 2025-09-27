function guessPin6Digit(checkPinFunc) {
  for (let pin = 0; pin < 1000000; pin++) {
    const pinStr = pin.toString().padStart(6, '0');
    if (checkPinFunc(pinStr)) {
      console.log(`PIN found: ${pinStr}`);
      return pinStr;
    }
  }
  console.log("PIN not found.");
  return null;
}