async function dictionaryGuesserRockyou(inputPassword, passwordFiles) {
  let passwords = [];
  for (const file of passwordFiles) {
    const response = await fetch(file);
    const text = await response.text();
    passwords = passwords.concat(text.split('\n').map(l => l.trim()).filter(l => l.length > 0));
  }
  console.log(`Loaded ${passwords.length} passwords from rockyou files`);
  for (const guess of passwords) {
    if (guess === inputPassword) {
      console.log(`Password is: ${guess}`);
      return true;
    }
  }
  console.log("Password not found in rockyou files.");
  return false;
}
