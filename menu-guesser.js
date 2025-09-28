// This file assumes isLoggedIn and logout are defined globally (from login.js)

const GUESSERS = [
  // ... (all previous guessers)
  {
    id: 'dictionary_common_sha256',
    label: 'Common Password Dictionary (SHA-256 Hash)',
    inputs: [{id: 'hashToFind', placeholder: 'Enter SHA-256 hash to guess'}],
    handler: async ({hashToFind}) => {
      const found = await dictionaryGuesserCommonSHA256(hashToFind, 'common_passwords.txt');
      return found
        ? `Password for hash is: ${found}`
        : 'Hash NOT found in common passwords.';
    }
  }
  // ... (rest of your guessers as before)
];

// Main UI loader
function showMenuGuesser() {
  const app = document.getElementById('guesserApp');
  app.innerHTML = `
    <h3>Password & PIN Guessers</h3>
    <div id="guesserButtons" style="margin-bottom:1em;"></div>
    <div id="guesserInputs"></div>
    <button id="guesserBtn" style="margin-top:1em; display:none;">Guess!</button>
    <div id="guesserResult" style="margin-top:1em;"></div>
  `;

  const buttonsDiv = document.getElementById('guesserButtons');
  const inputsDiv = document.getElementById('guesserInputs');
  const resultDiv = document.getElementById('guesserResult');
  const guesserBtn = document.getElementById('guesserBtn');

  // Add buttons for each guesser
  buttonsDiv.innerHTML = GUESSERS.map(
    g => `<button class="guesserSelectBtn" data-id="${g.id}">${g.label}</button>`
  ).join(' ');

  let currentGuesser = null;

  function loadGuesser(guesserId) {
    const guesser = GUESSERS.find(g => g.id === guesserId);
    currentGuesser = guesser;
    // Show input fields for selected guesser
    inputsDiv.innerHTML = guesser.inputs.map(
      inp => `<input type="text" id="${inp.id}" placeholder="${inp.placeholder}">`
    ).join('<br>');
    guesserBtn.style.display = 'inline-block';
    resultDiv.textContent = '';
  }

  // Button click listeners
  document.querySelectorAll('.guesserSelectBtn').forEach(btn => {
    btn.onclick = () => loadGuesser(btn.dataset.id);
  });

  // Handler for Guess button
  guesserBtn.onclick = async function() {
    if (!currentGuesser) return;
    const inputValues = {};
    currentGuesser.inputs.forEach(inp => {
      inputValues[inp.id] = document.getElementById(inp.id).value;
    });
    resultDiv.textContent = 'Guessing...';
    let output;
    try {
      output = await currentGuesser.handler(inputValues);
    } catch (err) {
      output = 'Error: ' + err;
    }
    resultDiv.textContent = output;
  };
}
