const GUESSERS = [
  {
    id: 'dictionary_rockyou',
    label: 'RockYou Dictionary',
    inputs: [{id: 'userPassword', placeholder: 'Enter password to guess'}],
    handler: async ({userPassword}) => {
      const rockyouFiles = ['rockyou_max_aa.txt', 'rockyou_max_ab.txt'];
      return await dictionaryGuesserRockyou(userPassword, rockyouFiles)
        ? 'Password found in RockYou!'
        : 'Password NOT found in RockYou.';
    }
  },
  {
    id: 'dictionary_common',
    label: 'Common Password Dictionary',
    inputs: [{id: 'userPassword', placeholder: 'Enter password to guess'}],
    handler: async ({userPassword}) => {
      return await dictionaryGuesserCommon(userPassword, 'common_passwords.txt')
        ? 'Password found in common passwords!'
        : 'Password NOT found in common passwords.';
    }
  },
  {
    id: 'dictionary_advanced',
    label: 'Advanced Dictionary',
    inputs: [{id: 'userPassword', placeholder: 'Enter password to guess'}],
    handler: async ({userPassword}) => {
      return await dictionaryGuesserAdvanced(userPassword, 'advanced_common_passwords.txt')
        ? 'Password found in advanced dictionary!'
        : 'Password NOT found in advanced dictionary.';
    }
  },
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
  },
  {
    id: 'pin_4digit',
    label: '4-digit PIN Brute Force',
    inputs: [{id: 'pinToFind', placeholder: 'Enter PIN for demo'}],
    handler: ({pinToFind}) => {
      const found = guessPin4Digit(pin => pin === pinToFind);
      return found ? `PIN found: ${found}` : 'PIN NOT found.';
    }
  },
  {
    id: 'pin_6digit',
    label: '6-digit PIN Brute Force',
    inputs: [{id: 'pinToFind', placeholder: 'Enter PIN for demo'}],
    handler: ({pinToFind}) => {
      const found = guessPin6Digit(pin => pin === pinToFind);
      return found ? `PIN found: ${found}` : 'PIN NOT found.';
    }
  },
  {
    id: 'pin_8digit',
    label: '8-digit PIN Brute Force',
    inputs: [{id: 'pinToFind', placeholder: 'Enter PIN for demo'}],
    handler: ({pinToFind}) => {
      const found = guessPin8Digit(pin => pin === pinToFind);
      return found ? `PIN found: ${found}` : 'PIN NOT found.';
    }
  },
  {
    id: 'pin_8digit_updown',
    label: '8-digit PIN Up-Down',
    inputs: [{id: 'pinToFind', placeholder: 'Enter PIN for demo'}],
    handler: ({pinToFind}) => {
      const found = guessPin8DigitUpDown(pin => pin === pinToFind);
      return found ? `PIN found: ${found}` : 'PIN NOT found.';
    }
  },
  {
    id: 'password_all_possible',
    label: 'All Possible (ASCII Brute Force)',
    inputs: [{id: 'passwordToFind', placeholder: 'Enter password'}],
    handler: ({passwordToFind}) => {
      const found = passwordGuesserAllPossible(passwordToFind);
      return found ? `Password found: ${found}` : 'Password NOT found.';
    }
  },
  {
    id: 'password_basic_symbols',
    label: 'Basic Symbols Brute Force',
    inputs: [{id: 'passwordToFind', placeholder: 'Enter password'}],
    handler: ({passwordToFind}) => {
      const found = passwordGuesserBasicSymbols(passwordToFind);
      return found ? `Password found: ${found}` : 'Password NOT found.';
    }
  },
  {
    id: 'password_keyboard',
    label: 'Keyboard Symbols Brute Force',
    inputs: [{id: 'passwordToFind', placeholder: 'Enter password'}],
    handler: ({passwordToFind}) => {
      const found = passwordGuesserKeyboard(passwordToFind);
      return found ? `Password found: ${found}` : 'Password NOT found.';
    }
  },
  {
    id: 'password_lower_upper',
    label: 'Lower/Upper Letters Brute Force',
    inputs: [{id: 'passwordToFind', placeholder: 'Enter password'}],
    handler: ({passwordToFind}) => {
      const found = passwordGuesserLowerUpper(passwordToFind);
      return found ? `Password found: ${found}` : 'Password NOT found.';
    }
  },
  {
    id: 'password_nums',
    label: 'Letters & Numbers Brute Force',
    inputs: [{id: 'passwordToFind', placeholder: 'Enter password'}],
    handler: ({passwordToFind}) => {
      const found = passwordGuesserNums(passwordToFind);
      return found ? `Password found: ${found}` : 'Password NOT found.';
    }
  }
];


function showMenuGuesser() {
  const app = document.getElementById('guesserApp');
  app.innerHTML = `
    <h3>Password & PIN Guessers</h3>
    <div id="guesserButtons" style="margin-bottom:1em;"></div>
    <div id="selectedGuesser" style="margin-bottom:0.5em; font-weight:500; color:#3366cc;"></div> <!-- NEW: Selected guesser name -->
    <div id="guesserInputs"></div>
    <button id="guesserBtn" style="margin-top:1em; display:none;">Guess!</button>
    <div id="guesserResult" style="margin-top:1em;"></div>
    <div id="guesserTime" style="margin-top:0.5em; color:#666;"></div> <!-- NEW: Time taken -->
  `;

  const buttonsDiv = document.getElementById('guesserButtons');
  const selectedDiv = document.getElementById('selectedGuesser'); // NEW
  const inputsDiv = document.getElementById('guesserInputs');
  const resultDiv = document.getElementById('guesserResult');
  const guesserBtn = document.getElementById('guesserBtn');
  const timeDiv = document.getElementById('guesserTime'); // NEW

  buttonsDiv.innerHTML = GUESSERS.map(
    g => `<button class="guesserSelectBtn" data-id="${g.id}">${g.label}</button>`
  ).join(' ');

  let currentGuesser = null;

  function loadGuesser(guesserId) {
    const guesser = GUESSERS.find(g => g.id === guesserId);
    currentGuesser = guesser;
    // NEW: Show selected guesser name
    selectedDiv.textContent = `Selected Guesser: ${guesser.label}`;
    inputsDiv.innerHTML = guesser.inputs.map(
      inp => `<input type="text" id="${inp.id}" placeholder="${inp.placeholder}">`
    ).join('<br>');
    guesserBtn.style.display = 'inline-block';
    resultDiv.textContent = '';
    timeDiv.textContent = ''; // Clear time when switching guesser
    // Highlight active button
    document.querySelectorAll('.guesserSelectBtn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === guesserId);
    });
  }

  document.querySelectorAll('.guesserSelectBtn').forEach(btn => {
    btn.onclick = () => loadGuesser(btn.dataset.id);
  });

  guesserBtn.onclick = async function() {
    if (!currentGuesser) return;
    const inputValues = {};
    currentGuesser.inputs.forEach(inp => {
      inputValues[inp.id] = document.getElementById(inp.id).value;
    });
    resultDiv.textContent = 'Guessing...';
    timeDiv.textContent = '';
    let output;
    let t0 = performance.now();
    try {
      output = await currentGuesser.handler(inputValues);
    } catch (err) {
      output = 'Error: ' + err;
    }
    let t1 = performance.now();
    resultDiv.textContent = output;
    // NEW: Show time taken
    timeDiv.textContent = `Time taken: ${(t1 - t0).toFixed(2)} ms`;
  };
}
