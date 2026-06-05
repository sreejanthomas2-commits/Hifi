
function toggleAIVirtualKeyboard() {
  const panel = document.getElementById('ai-virtual-keyboard-panel');
  if (panel) {
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      panel.style.display = 'flex';
    } else {
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }
  }
}

function vkTypeAI(char) {
  const input = document.getElementById('ai-input');
  if (!input) return;
  if (char === 'BACKSPACE') {
    input.value = input.value.slice(0, -1);
  } else if (char === 'ENTER') {
    sendAI();
  } else if (char === 'SPACE') {
    input.value += ' ';
  } else {
    input.value += char;
  }
  input.focus();
}
