(() => {
  const catalog = document.querySelector("[data-catalog]");
  const tabList = catalog.querySelector('[role="tablist"]');
  const tabButtons = [...tabList.querySelectorAll('[role="tab"]')];
  const scrollHint = catalog.querySelector("[data-catalog-hint]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 43rem)");
  const siteHeader = document.querySelector(".site-header");
  const assemblyKey = "nauka-prosto.catalog.assembled.";
  const assembled = new Set();
  const products = new Map();

  const panels = tabButtons.map(tab => {
    const element = document.getElementById(tab.getAttribute("aria-controls"));
    const cards = [...element.querySelectorAll("[data-product-id]")].map(card => {
      const id = card.dataset.productId;
      const price = card.dataset.priceKopecks;
      const example = card.hasAttribute("data-example");
      const layers = [...card.querySelectorAll(".product-piece")];
      const pieces = layers.map((layer, index) => {
        const [x, y] = layer.dataset.offset.split(" ").map(Number);
        const delay = index / Math.max(1, layers.length - 1);
        return {
          layer, x, y,
          angle: Number(layer.dataset.angle),
          pivot: layer.dataset.pivot || "0 0",
          start: .11 * delay,
          end: .68 + .32 * delay
        };
      });
      const item = {
        id,
        element: card,
        title: card.querySelector("h3").textContent.trim(),
        art: card.querySelector(".product-art"),
        pieces,
        add: card.querySelector("[data-add-product]"),
        note: card.querySelector("[data-product-feedback]"),
        orderLink: card.querySelector("[data-order-link]"),
        example,
        price: !example && /^\d+$/.test(price) && Number.isSafeInteger(Number(price)) ? Number(price) : null
      };
      products.set(id, item);
      return item;
    });
    return { element, cards, title: tab.textContent.trim() };
  });

  function readAssembly() {
    try {
      for (const id of products.keys()) {
        if (localStorage.getItem(assemblyKey + id) === "1") assembled.add(id);
      }
    } catch {
      // The current page can still assemble cards when storage is unavailable.
    }
  }

  function paintAssembly(product, progress) {
    if (product.progress === progress) return;
    product.progress = progress;

    for (const piece of product.pieces) {
      const remaining = 1 - easeBetween(piece.start, piece.end, progress);
      if (remaining === 0) {
        piece.layer.removeAttribute("transform");
      } else {
        const x = piece.x * remaining;
        const y = piece.y * remaining;
        const angle = piece.angle * remaining;
        piece.layer.setAttribute("transform", `translate(${x} ${y}) rotate(${angle} ${piece.pivot})`);
      }
    }
    product.element.style.setProperty("--product-progress", easeBetween(0, 1, progress));
    product.element.dataset.assembled = String(progress === 1);
  }

  function finishAssembly(product) {
    assembled.add(product.id);
    try {
      localStorage.setItem(assemblyKey + product.id, "1");
    } catch {
      // Retain completion in memory if the browser disallows storage.
    }
  }

  let activeIndex = 0;
  let scrollOrigin = window.scrollY;
  let frame = 0;

  function showPanel() {
    const panel = panels[activeIndex];
    const compact = reduced.matches || panel.cards.every(product => assembled.has(product.id));
    panel.element.toggleAttribute("data-compact", compact);
    for (const product of panel.cards) {
      paintAssembly(product, reduced.matches || assembled.has(product.id) ? 1 : 0);
    }
    scrollHint.hidden = compact;
    scrollHint.style.visibility = "";
    scrollOrigin = window.scrollY;
    scheduleAssembly();
  }

  function selectTab(index) {
    activeIndex = index;
    tabButtons.forEach((tab, position) => {
      const visible = position === index;
      tab.setAttribute("aria-selected", String(visible));
      tab.tabIndex = visible ? 0 : -1;
      panels[position].element.hidden = !visible;
    });
    showPanel();
  }

  function updateAssembly() {
    frame = 0;
    const panel = panels[activeIndex];
    if (reduced.matches || panel.element.hasAttribute("data-compact")) return;

    const viewport = window.innerHeight;
    const top = siteHeader.offsetHeight;
    const available = viewport - top;
    if (available <= 0) return;

    const moved = Math.max(0, window.scrollY - scrollOrigin);
    for (const product of panel.cards) {
      if (assembled.has(product.id)) continue;

      const rect = product.art.getBoundingClientRect();
      if (rect.top >= viewport || rect.bottom <= top || rect.height === 0) continue;

      // Start once the illustration is in view and finish above the sticky header.
      const start = Math.max(top + available * .43, Math.min(viewport - rect.height - 6, top + available * .82));
      const end = Math.max(top + available * .13, start - rect.height * (narrow.matches ? 1.35 : .9));
      const travel = Math.min(moved, start - rect.top);
      const progress = clamp(travel / (start - end));
      paintAssembly(product, progress);
      if (progress === 1) finishAssembly(product);
    }

    if (panel.cards.every(product => assembled.has(product.id))) scrollHint.style.visibility = "hidden";
  }

  function scheduleAssembly() {
    if (!frame && !reduced.matches) frame = requestAnimationFrame(updateAssembly);
  }

  tabButtons.forEach((button, index) => button.addEventListener("click", () => selectTab(index)));
  tabList.addEventListener("keydown", event => {
    const current = tabButtons.indexOf(event.target);
    if (current === -1) return;

    const previous = (current - 1 + tabButtons.length) % tabButtons.length;
    const next = (current + 1) % tabButtons.length;
    const index = { ArrowLeft: previous, ArrowRight: next, Home: 0, End: tabButtons.length - 1 }[event.key];
    if (typeof index !== "number") return;

    event.preventDefault();
    selectTab(index);
    tabButtons[index].focus({ preventScroll: true });
  });

  window.addEventListener("scroll", () => {
    scrollOrigin = Math.min(scrollOrigin, window.scrollY);
    scheduleAssembly();
  }, { passive: true });
  window.addEventListener("resize", scheduleAssembly);
  window.addEventListener("hashchange", () => {
    if (location.hash === "#nabory") showPanel();
  });
  window.addEventListener("pageshow", () => {
    readAssembly();
    showPanel();
  });
  window.addEventListener("storage", event => {
    if (event.newValue !== "1" || !event.key?.startsWith(assemblyKey)) return;

    const product = products.get(event.key.slice(assemblyKey.length));
    if (!product) return;

    assembled.add(product.id);
    paintAssembly(product, 1);
  });
  reduced.addEventListener("change", showPanel);

  readAssembly();
  selectTab(0);
  tabList.hidden = false;

  const order = document.querySelector("[data-order-form]");
  const picker = order.querySelector("[data-order-picker]");
  const pickerAdd = order.querySelector("[data-order-add]");
  const lineList = order.querySelector("[data-order-lines]");
  const empty = order.querySelector("[data-order-empty]");
  const orderState = order.querySelector("[data-order-state]");
  const orderTotal = order.querySelector("[data-order-total]");
  const result = order.querySelector("[data-order-result]");
  const draft = order.querySelector("[data-order-draft]");
  const name = order.elements.namedItem("name");
  const contact = order.elements.namedItem("contact");
  const comment = order.elements.namedItem("comment");
  const lineTemplate = document.querySelector("#order-line-template");
  const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
  const selection = new Map();

  function clearDraft() {
    result.textContent = "";
    draft.hidden = true;
    draft.removeAttribute("href");
  }

  function updateCard(product, quantity) {
    product.note.textContent = quantity ? "Добавлено в заказ" : "";
    product.orderLink.hidden = !quantity;
  }

  function pricedTotal() {
    const lines = [...selection.values()];
    const priced = lines.filter(({ product }) => product.price !== null);
    if (!priced.length) return "";

    const total = priced.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
    const label = priced.length === lines.length ? "Итого" : "По позициям с подтверждённой ценой";
    return `${label} — ${currency.format(total / 100)}`;
  }

  function updateOrder() {
    empty.hidden = selection.size > 0;
    orderState.hidden = ![...selection.values()].some(({ product }) => product.example || product.price === null);
    orderTotal.textContent = pricedTotal();
    orderTotal.hidden = orderTotal.textContent === "";
    clearDraft();
  }

  function removeLine(item) {
    const next = item.row.nextElementSibling || item.row.previousElementSibling;
    const focus = next?.querySelector(".order-remove") || picker;
    item.row.remove();
    selection.delete(item.product.id);
    updateCard(item.product, 0);
    updateOrder();
    focus.focus({ preventScroll: true });
  }

  function createLine(product) {
    const row = lineTemplate.content.firstElementChild.cloneNode(true);
    const amount = row.querySelector("input");
    const remove = row.querySelector(".order-remove");
    const item = { product, row, amount, quantity: 0 };

    row.dataset.orderId = product.id;
    row.querySelector("[data-line-name]").textContent = product.title;
    amount.setAttribute("aria-label", `Количество — ${product.title}`);
    remove.setAttribute("aria-label", `Убрать «${product.title}»`);
    remove.addEventListener("click", () => removeLine(item));
    amount.addEventListener("input", () => {
      amount.setCustomValidity("");
      if (!amount.value) {
        clearDraft();
        return;
      }

      const quantity = amount.valueAsNumber;
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        amount.setCustomValidity("Укажи целое количество от 1.");
        clearDraft();
        return;
      }

      item.quantity = quantity;
      updateCard(product, quantity);
      updateOrder();
    });
    lineList.append(row);
    selection.set(product.id, item);
    return item;
  }

  function addProduct(product) {
    const item = selection.get(product.id) || createLine(product);
    item.quantity = Math.min(Number.MAX_SAFE_INTEGER, item.quantity + 1);
    item.amount.value = item.quantity;
    item.amount.setCustomValidity("");
    updateCard(product, item.quantity);
    updateOrder();
  }

  function validContact(value) {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const digits = value.replace(/\D/g, "");
    const phone = /^\+?[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
    return email || phone;
  }

  for (const panel of panels) {
    const group = document.createElement("optgroup");
    group.label = panel.title;
    for (const product of panel.cards) {
      group.append(new Option(product.title, product.id));
      product.add.disabled = false;
      product.add.addEventListener("click", () => addProduct(product));
    }
    picker.append(group);
  }

  picker.addEventListener("change", () => {
    pickerAdd.disabled = !products.has(picker.value);
  });
  pickerAdd.addEventListener("click", () => {
    const product = products.get(picker.value);
    if (product) addProduct(product);
  });
  for (const field of [name, contact, comment]) {
    field.addEventListener("input", () => {
      field.setCustomValidity("");
      clearDraft();
    });
  }

  order.addEventListener("submit", event => {
    event.preventDefault();
    if (!selection.size) {
      result.textContent = "Добавь хотя бы одну позицию.";
      picker.focus();
      return;
    }

    if (!name.value.trim()) {
      name.setCustomValidity("Укажи имя.");
      name.reportValidity();
      return;
    }
    if (!validContact(contact.value.trim())) {
      contact.setCustomValidity("Укажи телефон или email для связи.");
      contact.reportValidity();
      return;
    }

    const lines = [...selection.values()].map(({ product, quantity }) =>
      `• ${product.title} — ${quantity} шт.${product.example ? " (пример)" : ""}`
    );
    const total = pricedTotal();
    const body = [
      "Здравствуйте!",
      "",
      "Хочу уточнить возможность заказа.",
      "",
      ...lines,
      ...(total ? ["", total] : []),
      "",
      `Имя — ${name.value.trim()}`,
      `Телефон или email — ${contact.value.trim()}`,
      ...(comment.value.trim() ? ["", `Комментарий — ${comment.value.trim()}`] : [])
    ].join("\r\n");
    const subject = "Наука просто — запрос на наборы";
    draft.href = `mailto:${order.dataset.recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    draft.hidden = false;
    result.textContent = "Письмо подготовлено";
    draft.click();
  });

  order.hidden = false;
})();
