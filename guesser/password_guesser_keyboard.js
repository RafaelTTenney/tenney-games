function passwordGuesserKeyboard(inputPassword) {
  const storage = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=~`[]{}|;:'\",.<>?/\\";
  if (inputPassword.length < 3) {
    console.log("Password must be at least 3 characters long.");
    return null;
  }
  const chars = storage.split('');
  const length = inputPassword.length;
  let found = null;
  function recurse(prefix) {
    if (prefix.length === length) {
      if (prefix === inputPassword) {
        found = prefix;
        console.log("Password is: " + prefix);
      }
      return;
    }
    for (const c of chars) {
      if (found) break;
      recurse(prefix + c);
    }
  }
  recurse('');
  if (!found) console.log("Password not found.");
  return found;
}
