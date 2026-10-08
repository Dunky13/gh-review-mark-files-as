(() => {
  const defaults = { buttons: [{ id: 'all', name: 'All Files', include: '', exclude: '' }] };
  function normalize(value) {
    if (value === undefined) return { buttons: defaults.buttons.map(button => ({ ...button })) };
    if (!value || !Array.isArray(value.buttons) || value.buttons.length > 20) {
      throw new Error('Button settings are invalid. Open Settings and save them again.');
    }
    const ids = new Set();
    return { buttons: value.buttons.map(button => {
      if (!button || typeof button.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(button.id)
        || ids.has(button.id) || typeof button.name !== 'string' || !button.name.trim()
        || button.name.length > 60 || typeof button.include !== 'string' || typeof button.exclude !== 'string') {
        throw new Error('Button settings are invalid. Each button needs a unique ID, name, and file patterns.');
      }
      ids.add(button.id);
      return { id: button.id, name: button.name.trim(), include: button.include, exclude: button.exclude };
    }) };
  }
  function patterns(text) {
    return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      .map(pattern => pattern.startsWith('/') ? pattern.slice(1) : pattern);
  }
  // Keep wildcard matching bounded: each token scans the path once. A regex
  // with repeated stars and literals can backtrack exponentially on a mismatch.
  function matchesPattern(pattern, path) {
    let positions = new Uint8Array(path.length + 1);
    positions[0] = 1;
    for (let index = 0; index < pattern.length; index++) {
      const char = pattern[index];
      const next = new Uint8Array(path.length + 1);
      if (char === '*') {
        const crossesFolders = pattern[index + 1] === '*';
        if (crossesFolders) index++;
        const folderPrefix = crossesFolders && pattern[index + 1] === '/';
        if (folderPrefix) index++;
        let reachable = false;
        for (let offset = 0; offset <= path.length; offset++) {
          reachable = Boolean(positions[offset]) || (reachable && (crossesFolders || path[offset - 1] !== '/'));
          if (reachable && (!folderPrefix || positions[offset] || path[offset - 1] === '/')) next[offset] = 1;
        }
      } else {
        for (let offset = 0; offset < path.length; offset++) {
          if (positions[offset] && (char === '?' ? path[offset] !== '/' : path[offset] === char)) next[offset + 1] = 1;
        }
      }
      positions = next;
    }
    return Boolean(positions[path.length]);
  }
  function compile(value) {
    const settings = value || defaults.buttons[0];
    const include = patterns(settings.include);
    const exclude = patterns(settings.exclude);
    return {
      active: include.length > 0 || exclude.length > 0,
      matches: path => (include.length === 0 || include.some(pattern => matchesPattern(pattern, path)))
        && !exclude.some(pattern => matchesPattern(pattern, path)),
    };
  }
  globalThis.reviewFileSettings = { defaults, normalize, compile };
})();
