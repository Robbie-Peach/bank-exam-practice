'use strict';

// A deliberately small event/DOM adapter for executing the complete application
// scripts in Node. It does not model layout, HTML parser recovery, or a browser.
const vm = require('node:vm');

function decode(value) {
  return String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function createDom(html, options = {}) {
  const elements = new Map(), nav = [], optionNodes = [], downloads = [], errors = [], timers = new Map();
  const storage = options.storage || new Map();
  let nextTimer = 0;
  const document = {
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll(selector) {
      if (selector === '[data-view]') return nav;
      if (selector === '[data-option]' || selector === '.opt') return optionNodes;
      throw new Error('DOM stub: unsupported selector ' + selector);
    },
    addEventListener(type, callback) { document['on' + type] = callback; },
    createElement(tag) { return new Element(tag); }
  };

  class Element {
    constructor(tag = 'div', attributes = {}) {
      this.tagName = tag.toUpperCase(); this.attributes = {}; this.dataset = {};
      this.style = {}; this.hidden = false; this.disabled = false; this.checked = false;
      this.value = ''; this.textContent = ''; this.options = []; this.files = [];
      this._html = ''; this._classes = new Set(); this.mark = { textContent: '' };
      this.classList = {
        add: (...names) => names.forEach(name => this._classes.add(name)),
        remove: (...names) => names.forEach(name => this._classes.delete(name)),
        contains: name => this._classes.has(name),
        toggle: (name, force) => {
          const next = force === undefined ? !this._classes.has(name) : !!force;
          if (next) this._classes.add(name); else this._classes.delete(name);
          return next;
        }
      };
      for (const [name, value] of Object.entries(attributes)) this.setAttribute(name, value);
    }
    get className() { return [...this._classes].join(' '); }
    set className(value) { this._classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      this._html = value;
      if (this.tagName === 'SELECT') {
        this.options = parseOptions(value); this.value = this.options[0]?.value || '';
      }
      if (this.id === 'options' || this.id === 'question-card') {
        optionNodes.length = 0;
        for (const match of value.matchAll(/<(button|div)\b([^>]*(?:data-option|data-i)="\d+"[^>]*)>/g)) {
          optionNodes.push(new Element(match[1], parseAttrs(match[2])));
        }
        if (/id="clear-filter"/.test(value)) new Element('button', { id: 'clear-filter' });
      }
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'id') { this.id = String(value); elements.set(this.id, this); }
      else if (name === 'class') this.className = String(value);
      else if (name.startsWith('data-')) this.dataset[name.slice(5)] = String(value);
      else if (name === 'value') this.value = String(value);
    }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    querySelector(selector) { if (selector === '.option-mark') return this.mark; throw new Error('Unsupported child selector ' + selector); }
    scrollIntoView() {}
    matches(selectors) { return selectors.split(',').includes(this.tagName.toLowerCase()); }
    click() {
      if (this.disabled) return;
      if (this.tagName === 'A' && this.download) downloads.push({ name: this.download, href: this.href });
      return this.onclick?.({ target: this });
    }
  }

  function parseAttrs(text) {
    return Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
  }
  function parseOptions(text) {
    return [...text.matchAll(/<option\s+value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)].map(m => ({ value: decode(m[1]), textContent: decode(m[2]) }));
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="[^"]+"[^>]*)>/gi)) new Element(match[1], parseAttrs(match[2]));
  for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const attrs = parseAttrs(match[1]);
    const element = elements.get(attrs.id); if (element) element.innerHTML = match[2];
  }
  for (const match of html.matchAll(/<button\b([^>]*\bdata-view="[^"]+"[^>]*)>/gi)) nav.push(new Element('button', parseAttrs(match[1])));
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*\bhidden(?:[\s>])/gi)) elements.get(match[1]).hidden = true;
  const blobUrls = new Map();
  class StubURL extends URL {}
  StubURL.createObjectURL = blob => { const value = 'blob:test-' + blobUrls.size; blobUrls.set(value, blob); return value; };
  StubURL.revokeObjectURL = url => blobUrls.delete(url);
  const sandbox = {
    document, localStorage: {
      getItem: key => { if (options.failRead) throw Error('storage blocked'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (options.failWrite) throw Error('storage full'); storage.set(key, String(value)); },
      removeItem: key => storage.delete(key)
    },
    URL: StubURL, Blob, console: { log() {}, error: value => errors.push(value) },
    navigator: {}, location: { protocol: 'file:', href: 'file:///test/index.html' },
    innerWidth: 390, alert: message => errors.push(message), confirm: () => options.confirm !== false,
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id)
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  return {
    context, document, storage, downloads, blobUrls, errors, timers,
    run: source => vm.runInContext(source, context),
    get: id => document.getElementById(id),
    pick: index => optionNodes[index].click(),
    navigate: view => nav.find(node => node.dataset.view === view).click(),
    async importFile(id, value) {
      const el = elements.get(id), text = typeof value === 'string' ? value : JSON.stringify(value);
      el.files = [{ size: Buffer.byteLength(text), text: async () => text }];
      await el.onchange.call(el);
    }
  };
}

module.exports = { createDom };
