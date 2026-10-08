(async () => {
  const form = document.querySelector('form');
  const fields = document.querySelector('fieldset');
  const container = document.querySelector('#buttons');
  const status = document.querySelector('#status');
  const add = document.querySelector('#add');

  function renderPatterns(card, button, key, title, help, placeholder) {
    const group = document.createElement('fieldset');
    group.className = 'pattern-group';
    const legend = document.createElement('legend');
    legend.textContent = title;
    if (key === 'include') {
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = 'Blank = all';
      hint.setAttribute('aria-hidden', 'true');
      legend.append(hint);
    }
    const description = document.createElement('p');
    description.className = 'visually-hidden';
    description.id = `${key}-${button.id}-help`;
    description.textContent = help;
    const rows = document.createElement('div');
    rows.className = 'pattern-rows';
    function updateLabels() {
      Array.from(rows.children).forEach((row, index) => {
        const input = row.querySelector('input');
        input.id = `${key}-${button.id}-${index}`;
        const label = row.querySelector('label');
        label.htmlFor = input.id;
        label.textContent = `${title} pattern ${index + 1}`;
        row.querySelector('.add-pattern').setAttribute('aria-label', `Add ${key} pattern after row ${index + 1}`);
        row.querySelector('.remove-pattern').setAttribute('aria-label', `Remove ${key} pattern ${index + 1}`);
      });
    }
    function addRow(value, after) {
      const row = document.createElement('div');
      row.className = 'pattern-row';
      const label = document.createElement('label');
      label.className = 'visually-hidden';
      const input = document.createElement('input');
      input.type = 'text';
      input.name = key;
      input.value = value;
      input.placeholder = placeholder;
      input.spellcheck = false;
      input.autocomplete = 'off';
      input.setAttribute('aria-describedby', description.id);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'add-pattern';
      plus.textContent = '+';
      plus.addEventListener('click', () => addRow('', row).focus());
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'remove-pattern';
      minus.textContent = '−';
      minus.addEventListener('click', () => {
        if (rows.children.length === 1) {
          input.value = '';
          input.focus();
          return;
        }
        const nextInput = (row.nextElementSibling || row.previousElementSibling).querySelector('input');
        row.remove();
        updateLabels();
        nextInput.focus();
      });
      row.append(label, input, plus, minus);
      if (after) after.after(row);
      else rows.append(row);
      updateLabels();
      return input;
    }
    const patterns = button[key].split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    (patterns.length ? patterns : ['']).forEach(value => addRow(value));
    group.append(legend, description, rows);
    card.append(group);
  }

  function readPatterns(card, key) {
    return Array.from(card.querySelectorAll(`input[name=${key}]`), input => input.value.trim())
      .filter(Boolean).join('\n');
  }

  function renderButton(button) {
    const card = document.createElement('section');
    card.className = 'button-settings';
    card.dataset.id = button.id;
    const label = document.createElement('label');
    label.htmlFor = `name-${button.id}`;
    label.textContent = 'Name';
    const name = document.createElement('input');
    name.id = label.htmlFor;
    name.name = 'name';
    name.value = button.name;
    name.placeholder = 'Tests';
    name.required = true;
    name.maxLength = 60;
    const header = document.createElement('div');
    header.className = 'button-header';
    header.append(label, name);
    card.append(header);
    const columns = document.createElement('div');
    columns.className = 'pattern-columns';
    card.append(columns);
    renderPatterns(columns, button, 'include', 'Include',
      'Match any of these patterns. Leave blank to include all files.', '**/*.test.*');
    renderPatterns(columns, button, 'exclude', 'Exclude',
      'Matching files stay untouched, even if included above.', '**/fixtures/**');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove button');
    remove.addEventListener('click', () => {
      card.remove();
      add.disabled = false;
      add.focus();
    });
    header.append(remove);
    container.append(card);
    add.disabled = container.children.length >= 20;
  }
  function render(settings) {
    container.replaceChildren();
    add.disabled = false;
    settings.buttons.forEach(renderButton);
  }
  async function save(settings) {
    fields.disabled = true;
    try {
      const normalized = reviewFileSettings.normalize(settings);
      await chrome.storage.local.set({ filePatterns: normalized });
      render(normalized);
      status.textContent = 'Settings saved.';
    } catch (error) {
      status.textContent = `Could not save settings: ${error.message}`;
    } finally {
      fields.disabled = false;
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const buttons = Array.from(container.children, card => ({
      id: card.dataset.id,
      name: card.querySelector('[name=name]').value,
      include: readPatterns(card, 'include'),
      exclude: readPatterns(card, 'exclude'),
    }));
    void save({ buttons });
  });
  add.addEventListener('click', () => {
    renderButton({ id: crypto.randomUUID(), name: '', include: '', exclude: '' });
    container.lastElementChild.querySelector('input').focus();
  });
  document.querySelector('#reset').addEventListener('click', () => void save(reviewFileSettings.defaults));
  try {
    const stored = await chrome.storage.local.get('filePatterns');
    render(reviewFileSettings.normalize(stored.filePatterns));
    fields.disabled = false;
  } catch (error) {
    status.textContent = `Could not load settings: ${error.message}`;
    fields.disabled = false;
  }
})();
