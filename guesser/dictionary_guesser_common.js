async function dictionaryGuesserCommon(inputPassword, passwordFile) {
  const response = await fetch(passwordFile);
  const text = await response.text();
  const passwords = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(`Loaded ${passwords.length} passwords from ${passwordFile}`);
  for (const guess of passwords) {
    if (guess === inputPassword) {
      console.log(`Password is: ${guess}`);
      return true;
    }
  }
  console.log("Password not found in dictionary.");
  return false;
}
