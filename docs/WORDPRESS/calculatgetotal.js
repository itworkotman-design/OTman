function calculateTotal() {
  let total = 0;

  const discountInput = document.querySelector(
    'input[name="acff[post][field_686e217030aaa]"]',
  );

  const manualDiscount = discountInput ? parseNOK(discountInput.value) : 0;
  // PLUS / Ekstra (uten MVA): prefer ACF field; fall back to the UI input if ACF is absent
  let manualPlus = 0;
  const plusACF = PLUS_ACF_KEY
    ? document.querySelector(`input[name="acff[post][${PLUS_ACF_KEY}]"]`)
    : null;
  if (plusACF) {
    manualPlus = parseNOK(plusACF.value);
  } else {
    const plusUI = document.getElementById("plus-input");
    manualPlus = plusUI ? parseNOK(plusUI.value) : 0;
  }

  let rawBreakdown = [];
  // ─── Auto-set order_created_at once ───────────────────────
  if (!savedCreatedOnce) {
    const createdEl = document.getElementById("acff-post-field_684feac9c43b7");
    if (createdEl && !createdEl.value) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const H = String(now.getHours()).padStart(2, "0");
      const M = String(now.getMinutes()).padStart(2, "0");
      createdEl.value = `${y}-${m}-${d} ${H}:${M}:00`;
    }
    savedCreatedOnce = true;
  }

  // ——— reference real Express checkbox ———
  const expressCheckbox = document.getElementById(
    "acff-post-field_684c3ad580b60-Express",
  );

  const flexContainer = document.querySelector(".acf-flexible-content");
  if (flexContainer) {
    const layouts = flexContainer.querySelectorAll(".layout:not(.acf-clone)");
    function fieldContainsKun(fieldEl) {
      if (!fieldEl) return false;

      // If select, check selected option text + value
      if (fieldEl.tagName === "SELECT") {
        const txt = (
          fieldEl.selectedOptions?.[0]?.textContent || ""
        ).toLowerCase();
        const val = (fieldEl.value || "").toLowerCase();
        return txt.includes("kun") || val.includes("kun");
      }

      // Inputs/text
      const v = (fieldEl.value || "").toLowerCase();
      return v.includes("kun");
    }

    function fieldContainsKunReturn(fieldEl) {
      if (!fieldEl) return false;

      const getTextVal = () => {
        if (fieldEl.tagName === "SELECT") {
          const txt = (
            fieldEl.selectedOptions?.[0]?.textContent || ""
          ).toLowerCase();
          const val = (fieldEl.value || "").toLowerCase();
          return `${txt} ${val}`;
        }
        return (fieldEl.value || "").toLowerCase();
      };

      const s = getTextVal();
      return s.includes("kun") && s.includes("retur");
    }

    function layoutHasKunReturn(layout, triggerIds) {
      return triggerIds.some((id) =>
        fieldContainsKunReturn(findFieldInLayout(layout, id)),
      );
    }

    function findFieldInLayout(layout, idOrKey) {
      // Supports both: acff-post-field_XXXXX OR name contains XXXXX (flex content rows)
      return (
        layout.querySelector(`#acff-post-field_${idOrKey}`) ||
        layout.querySelector(`[name*="${idOrKey}"]`) ||
        layout.querySelector(`[id*="${idOrKey}"]`)
      );
    }

    function layoutHasKun(layout, triggerIds) {
      return triggerIds.some((id) =>
        fieldContainsKun(findFieldInLayout(layout, id)),
      );
    }
    const KUN_TRIGGERS_L1 = [
      "681b162239347",
      "6880e6834088b",
      "68246df488e9a",
      "68235e7826058",
    ];
    const KUN_TRIGGERS_L2 = [
      "682b100495c6b",
      "6880eb12e3933",
      "682b102595c6c",
      "682b103d95c6d",
    ];

    const KUN_ZERO_RADIOS_L1 = ["681b211e616f6", "681b20ef42390"];
    const KUN_ZERO_RADIOS_L2 = ["682b205e4554c", "682b20404554b"];

    function isKunZeroRadioInput(inputEl, kunMode, radioIds) {
      if (!kunMode) return false;
      const n = inputEl.name || "";
      const i = inputEl.id || "";
      const v = inputEl.value || "";
      // match by name/id/value containing the frontend_admin field id
      return radioIds.some(
        (fid) => n.includes(fid) || i.includes(fid) || v.includes(fid),
      );
    }

    layouts.forEach((layout) => {
      let productLabel = "Produkt";
      const productSelect = layout.querySelector('select[name*="field_"]');

      // must exist before any pushes
      let groupItems = [];

      const selectedValue = (productSelect?.value || "").toLowerCase();

      if (selectedValue === "kasse levering") {
        groupItems.push({
          label: "Kasse levering (BOX)",
          price: 400,
          code: "BOX",
        });
      }
      const extraBoxCheckbox = layout.querySelector(
        'input[type="checkbox"][value*="BOXEXTRA"]:checked',
      );
      const extraBoxQtyInput = layout.querySelector(
        'input[name*="field_69dea96bffe4e"], input[name*="field_69ded876b1d5d"], input[name*="field_69dec9d8fd32d"]',
      );

      if (
        selectedValue === "kasse levering" &&
        extraBoxCheckbox &&
        extraBoxQtyInput
      ) {
        const qty = parseFloat(extraBoxQtyInput.value) || 0;
        if (qty > 0) {
          const subtotal = qty * 200;
          groupItems.push({
            label: `Extra box (BOXEXTRA) x${qty}`,
            price: subtotal,
            code: "BOXEXTRA",
          });
        }
      }
      if (productSelect?.selectedOptions?.length) {
        productLabel = productSelect.selectedOptions[0].textContent.trim();
      }

      // Push BASE PRODUCT only if price > 0
      if (productSelect) {
        const chosenText =
          productSelect.selectedOptions?.[0]?.textContent?.trim() ?? "";
        const chosenVal = productSelect.value?.trim() ?? "";
        const isPlaceholder =
          (!chosenText && !chosenVal) ||
          /^(velg|choose|select|--)/i.test(chosenText || chosenVal);

        if (!isPlaceholder) {
          const price = parsePrice(chosenVal);
          if (price > 0) {
            let { label, code } = parseLabelAndCode(chosenVal);
            if (!label) label = chosenText;
            if (!code) {
              const m = chosenText.match(/\(([^)]+)\)\s*$/);
              code = m ? m[1].trim() : chosenVal;
            }
            groupItems.push({
              label: formatLabel(label, code),
              price,
              code,
            });
          }
        }
      }

      // === HANDLE RETUR MULTIPLIER (radio + number) ===
      const returWrap = layout.querySelector(
        '.acf-field[data-key="field_682206a2252d2"]:not(.acf-hidden):not(.acf-clone)',
      );
      const qtyWrap = layout.querySelector(
        '.acf-field[data-key="field_6888cdca56635"]:not(.acf-hidden):not(.acf-clone)',
      );
      const returRadio = returWrap?.querySelector(
        'input[type="radio"]:enabled:checked',
      );
      const returQtyField = qtyWrap?.querySelector(
        'input[type="number"]:enabled',
      );

      if (returRadio && returQtyField) {
        const qty = parseFloat(returQtyField.value) || 0;
        if (qty > 0) {
          const unitPrice = parsePrice(returRadio.value);
          const { label, code } = parseLabelAndCode(returRadio.value);
          const subtotal = qty * unitPrice;

          const formattedLabel = `${formatLabel(label, code)} x${qty}`;
          groupItems.push({
            label: formattedLabel,
            price: subtotal,
            code,
          });

          total += subtotal;

          // ✅ Prevent general checkbox loop from reprocessing this
          layout.dataset.skipRetur = "true";
        }
      }

      // === HANDLE PALLET ===
      const palletCheckbox =
        layout.querySelector(
          'input[type="checkbox"][name*="field_682b20b245550"]',
        ) ||
        layout.querySelector(
          'input[type="checkbox"][name*="field_681b21e526309"]',
        );

      const palletQtyInput =
        layout.querySelector(
          'input[type="number"][name*="field_682b20cc45551"]',
        ) ||
        layout.querySelector(
          'input[type="number"][name*="field_681b2237f9ab3"]',
        );

      if (palletCheckbox?.checked && palletQtyInput) {
        const qty = parseFloat(palletQtyInput.value) || 0;
        if (qty > 0) {
          const subtotal = qty * 250;
          total += subtotal;
          groupItems.push({
            label: `Ekstra pall (PALLXTRAS1) x${qty}`,
            price: subtotal,
            code: "PALLXTRAS1",
          });
        }
      }

      // === HANDLE EXTRA BOX (with quantity) ===
      const boxCheckbox = layout.querySelector('input[name*="BOXEXTRA"]');
      const boxQtyInput = layout.querySelector(
        'input[name*="field_69dea96bffe4e"]',
      );

      if (boxCheckbox?.checked && boxQtyInput) {
        const qty = parseFloat(boxQtyInput.value) || 0;
        if (qty > 0) {
          const unitPrice = 200;

          const subtotal = qty * unitPrice;

          total += subtotal;

          groupItems.push({
            label: `Extra box (BOXEXTRA) x${qty}`,
            price: subtotal,
            code: "BOXEXTRA",
          });
        }
      }

      // === HANDLE HÅNDVERKER / ETTERMONTERING (generic, works for all checkboxes in the field) ===
      const checkboxQtyPairs = [
        { checkbox: "field_682de3292a5b7", qty: "field_682de505a2920" },
        { checkbox: "field_682de4c1a291f", qty: "field_682de569a2921" },
        { checkbox: "field_68839b93d0cc8", qty: "field_68839bcdd0cc9" },
        { checkbox: "field_68839e3c2bd3e", qty: "field_68839e4f2bd3f" },
        { checkbox: "field_690886f3b67da", qty: "field_690886f9b67db" },
        { checkbox: "field_690889e64a6e0", qty: "field_690889eb4a6e1" },
        { checkbox: "field_69de541a91505", qty: "field_690886f9b67db" },
        { checkbox: "field_69decaa840fe5", qty: "field_690889eb4a6e1" },
      ];

      checkboxQtyPairs.forEach(({ checkbox, qty }) => {
        const fieldWrap = layout.querySelector(
          `.acf-field[data-key="${checkbox}"]`,
        );
        const qtyField = layout.querySelector(
          `.acf-field[data-key="${qty}"] input[type="number"]`,
        );
        if (!fieldWrap || !qtyField) return;

        // Default hours when first checkbox in the group is ticked
        const anyChecked = !!fieldWrap.querySelector(
          'input[type="checkbox"]:enabled:checked',
        );
        if (anyChecked && !qtyField.value) qtyField.value = "0.5";

        // Delegate listeners once per field
        if (!fieldWrap.dataset.listenerAttached) {
          fieldWrap.addEventListener("change", (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
              if (e.target.checked && !qtyField.value) qtyField.value = "0.5";
              delayedCalculate();
            }
          });
          qtyField.addEventListener("input", delayedCalculate);
          fieldWrap.dataset.listenerAttached = "true";
        }

        // Hours (rounded to 0.5)
        let hours = Math.round((parseFloat(qtyField.value) || 0) * 2) / 2;
        if (hours <= 0) return;

        // For every checked option in THIS field, use its own unit price from ACF value
        const checked = [
          ...fieldWrap.querySelectorAll(
            'input[type="checkbox"]:enabled:checked',
          ),
        ];
        checked.forEach((cb) => {
          // Pull unit price, label and code from the checkbox's value string
          const unitPrice = parsePrice(cb.value); // e.g. 300 / 350 / 500
          let { label, code } = parseLabelAndCode(cb.value); // e.g. label text, ANDRE/TIME1/TIME2

          // Fallbacks (legacy safety)
          if (!unitPrice || unitPrice <= 0) {
            // keep old behavior if value was missing a price
            // (you can remove this branch once all values are in the new format)
            const fallbackRate = 600;
            if (!code)
              code = ["Andre produkter", "Ettermontering"].includes(
                productLabel,
              )
                ? "ANDRE"
                : "XTRA";
            if (!label) {
              const rawLabel = cb.closest("label")?.textContent?.trim() || "";
              label = rawLabel.replace(/\s*\(([^)]+)\)\s*x?.*$/, "").trim();
            }
            const subtotal = hours * fallbackRate;
            total += subtotal;
            groupItems.push({
              label: `${formatLabel(label, code)} x${hours} time`,
              price: subtotal,
              code,
            });
            return;
          }

          // Normal path: multiply hours by the per-option unit price
          const subtotal = hours * unitPrice;
          if (!label) {
            const rawLabel = cb.closest("label")?.textContent?.trim() || "";
            label = rawLabel.replace(/\s*\(([^)]+)\)\s*x?.*$/, "").trim();
          }
          if (!code) {
            // conservative fallback for older options without a code
            code = ["Andre produkter", "Ettermontering"].includes(productLabel)
              ? "ANDRE"
              : "XTRA";
          }

          total += subtotal;
          groupItems.push({
            label: `${formatLabel(label, code)} x${hours} time`,
            price: subtotal,
            code,
          });
        });

        // Tell the catch-all loop we’ve handled this field (prevents double counting)
        layout.dataset.skipSnekker = "true";
      });

      // Fields whose checkboxes are priced by hours (handled above)
      const TIME_FIELDS = new Set([
        "field_682de3292a5b7",
        "field_682de4c1a291f",
        "field_68839b93d0cc8",
        "field_68839e3c2bd3e",
        "field_69de541a91505",
        "field_69decaa840fe5",
      ]);

      // Catch-all: push priced checkboxes except those handled by TIME_FIELDS
      layout
        .querySelectorAll(
          '.price-item:not(.acf-hidden) input[type="checkbox"]:enabled:checked',
        )
        .forEach((input) => {
          const wrapper = input.closest(".acf-field");
          const fieldKey = wrapper?.dataset.key || "";

          // Skip time-priced groups (already added with hours × 600)
          if (TIME_FIELDS.has(fieldKey)) return;

          // Skip hidden wrappers (belt & suspenders)
          if (wrapper?.classList.contains("acf-hidden")) return;

          // Skip pallet (has its own qty block above)
          if (
            input.name.includes("field_682b20b245550") ||
            input.name.includes("field_681b21e526309")
          )
            return;

          // Skip explicitly excluded field
          if (input.name.includes("field_68272eb0ae0db")) return;
          if (input.name.includes("field_690886f3b67da")) return;
          if (input.name.includes("field_690889e64a6e0")) return;

          // Skip RETUR (handled in special radio+qty block)
          if (layout.dataset.skipRetur === "true") return;

          // Skip global XTRAARBEID (handled elsewhere)
          if (input.value.includes("XTRAARBEID")) return;

          // Skip BOXEXTRA (handled in custom qty block)
          if (input.value.includes("BOXEXTRA")) return;

          // Normal priced checkbox
          const price = parsePrice(input.value);
          if (price > 0) {
            const { label, code } = parseLabelAndCode(input.value);
            groupItems.push({ label: formatLabel(label, code), price, code });
          }
        });

      // Decide which trigger/radio set applies for THIS layout
      const isL1 = KUN_TRIGGERS_L1.some(
        (id) => !!findFieldInLayout(layout, id),
      );
      const isL2 =
        !isL1 && KUN_TRIGGERS_L2.some((id) => !!findFieldInLayout(layout, id));

      const kunReturnMode =
        (isL1 && layoutHasKunReturn(layout, KUN_TRIGGERS_L1)) ||
        (isL2 && layoutHasKunReturn(layout, KUN_TRIGGERS_L2));

      // const kunRadioIds = isL1 ? KUN_ZERO_RADIOS_L1 : (isL2 ? KUN_ZERO_RADIOS_L2 : []);
      const kunRadioIds = isL1 ? KUN_ZERO_RADIOS_L1 : []; // L2 will never forceZero

      layout
        .querySelectorAll('.price-item input[type="radio"]:checked')
        .forEach((input) => {
          const fieldWrapper = input.closest(".acf-field");

          const isReturRadio =
            fieldWrapper?.dataset.key === "field_682206a2252d2";
          if (isReturRadio) return; // RETUR handled elsewhere

          const forceZero = isKunZeroRadioInput(
            input,
            kunReturnMode,
            kunRadioIds,
          );

          const price = forceZero ? 0 : parsePrice(input.value);

          // ✅ normal behavior: only push if >0
          // ✅ special rule: if Kun-mode on the trigger fields, push this radio even if price is 0
          if (price > 0 || forceZero) {
            const { label, code } = parseLabelAndCode(input.value);
            groupItems.push({
              label: formatLabel(label, code),
              price,
              code,
              kunZero: forceZero === true, // ✅ mark only the special case
            });
          }
        });

      layout.querySelectorAll(".price-item select").forEach((select) => {
        const wrap = select.closest(".acf-field");

        const lbl =
          wrap.querySelector("label")?.textContent?.trim().toLowerCase() || "";
        if (lbl.includes("velg produkt")) return; // don’t treat product picker as priced

        const price = parsePrice(select.value);
        if (price > 0) {
          const { label, code } = parseLabelAndCode(select.value);
          // if (code === 'RETURNREC') return; // (optional hard stop)
          groupItems.push({ label: formatLabel(label, code), price, code });
        }
      });

      // Deduplicate DELIVERY / INDOOR / XTRA only within each product layout
      const seenCodes = new Set();
      groupItems = groupItems.filter((item) => {
        if (["DELIVERY", "INDOOR", "XTRA"].includes(item.code)) {
          const key = item.code;
          if (seenCodes.has(key)) return false;
          seenCodes.add(key);
        }
        return true;
      });

      // === HANDLE MULTIPLIER AND PUSH TO BREAKDOWN ===
      let multiplier = 1;
      const multField =
        layout.querySelector(
          '.acf-field[data-key="field_688b6e9bb4434"] input[type="number"]',
        ) || // First layout
        layout.querySelector(
          '.acf-field[data-key="field_688b7e4897363"] input[type="number"]',
        ); // Second layout

      if (multField) {
        multiplier = parseInt(multField.value) || 1;
        if (multiplier < 1) multiplier = 1;
      }

      let hasDelivery = groupItems.some((i) => i.code === "DELIVERY");
      let hasIndoor = groupItems.some((i) => i.code === "INDOOR");
      let adjustedGroup = [];

      if (multiplier > 1) {
        const extraMultiplier = multiplier - 1;

        groupItems.forEach((item) => {
          if (
            ["DELIVERY", "INDOOR", "Montering", "RETURIN"].includes(item.code)
          ) {
            adjustedGroup.push(item); // keep DELIVERY/INDOOR unmultiplied
            total += item.price; // but still include original in total
          } else {
            const multipliedItem = {
              label: `${item.label} x${multiplier}`,
              price: item.price * multiplier,
              code: item.code,
            };
            adjustedGroup.push(multipliedItem);
            total += multipliedItem.price;
          }
        });

        if (hasDelivery) {
          adjustedGroup.push({
            label: `Ekstra levering (XTRA) x${extraMultiplier}`,
            price: 150 * extraMultiplier,
            code: "XTRA",
          });
          total += 150 * extraMultiplier;
        }

        if (hasIndoor) {
          adjustedGroup.push({
            label: `Ekstra innbæring (XTRA) x${extraMultiplier}`,
            price: 229 * extraMultiplier,
            code: "XTRA",
          });
          total += 229 * extraMultiplier;
        }
      } else {
        // No multiplier, just add everything as-is
        adjustedGroup = groupItems;
        adjustedGroup.forEach((item) => {
          total += item.price;
        });
      }

      if (adjustedGroup.length > 0) {
        rawBreakdown.push({ label: productLabel, group: adjustedGroup });
      }
    });
  }

  // ——— HANDLE GLOBAL TILLEGG 20min XTRAARBEID ———
  const arbeidChecked = !!document.querySelector(
    '.acf-field[data-key="field_68760a149a59b"] input[type="checkbox"][value$="XTRAARBEID"]:checked',
  );

  // You have one minutes field, but this also works if more appear later.
  const arbeidMinutesInputs = [
    ...document.querySelectorAll(
      '.acf-field[data-key="field_68760ebfe7f33"] input[type="number"]',
    ),
  ];
  const totalMinutes = arbeidMinutesInputs.reduce(
    (sum, el) => sum + (parseInt(el.value) || 0),
    0,
  );

  if (arbeidChecked && totalMinutes > 0) {
    const blocks = Math.ceil(totalMinutes / 20);
    const subtotal = blocks * 150;
    total += subtotal;

    rawBreakdown.push({
      label: `<strong>Tillegg for ekstra arbeid per påbegynt 20 min x${blocks} (XTRAARBEID)</strong>`,
      price: subtotal,
      code: "XTRAARBEID",
    });
  }

  // ——— HANDLE GEBYR FOR TILLEGG AV BESTILLING ———
  const addOrderCheckbox = document.querySelector(
    '.acf-field[data-key="field_690216d860a13"] input[type="checkbox"]:checked',
  );

  if (addOrderCheckbox) {
    total += 99;
    rawBreakdown.push({
      label: `<strong>Gebyr for tillegg av bestilling (ADDORDER)</strong>`,
      price: 99,
      code: "ADDORDER",
    });
  }

  const extraPickupInputs = document.querySelectorAll(
    'input[name*="field_68248274acd3f"]',
  );
  let extraPickupCount = 0;
  extraPickupInputs.forEach((input) => {
    if (input.value.trim()) extraPickupCount++;
  });
  if (extraPickupCount > 0) {
    const pickupPrice = extraPickupCount * 590;
    total += pickupPrice;
    rawBreakdown.push({
      label: `<strong>EXTRA PICKUP (EXTRAPICKUP) x${extraPickupCount}</strong>`,
      price: pickupPrice,
      code: "EXTRAPICKUP",
    });
  }

  const kmField = document.getElementById("acff-post-field_682482a1acd41");
  const totalKm = parseFloat(kmField?.value) || 0;
  if (totalKm > 20) {
    const kmCharge = Math.round((totalKm - 20) * 28);
    total += kmCharge;
    rawBreakdown.push({
      label: "<strong>KM pris</strong>",
      price: kmCharge,
      code: "KM2",
    });
  }

  let hasTargetCode = rawBreakdown.some((item) => {
    if (item.group) {
      return item.group.some((sub) =>
        ["SIDEBYSIDE", "SIDEBYSIDETRAPP", "INSSBS1", "INSSBS2"].includes(
          sub.code,
        ),
      );
    }
    return ["SIDEBYSIDE", "SIDEBYSIDETRAPP", "INSSBS1", "INSSBS2"].includes(
      item.code,
    );
  });

  const extraLayouts = document.querySelectorAll(
    '.acf-flexible-content .layout[data-layout="extra_produkt"]',
  );
  extraLayouts.forEach((layout) => {
    const select = layout.querySelector('select[name*="field_"]');
    const selected = select?.selectedOptions?.[0]?.textContent?.trim();
    if (selected === "Kombiskap") {
      hasTargetCode = true;
    }
  });

  // ─── Pick baseTime ───────────────────────────────────────────
  const createdEl = document.getElementById("acff-post-field_684feac9c43b7");
  const rawCreated = createdEl?.value;
  let baseTime = rawCreated
    ? new Date(rawCreated.replace(" ", "T"))
    : new Date();

  // ─── Express-fee logic (rules 1–4) ───────────────────────────
  const dateInputWrap = document.querySelector(
    '.acf-field[data-key="field_682358b62c3b4"]:not(.acf-clone) .acf-date-picker',
  );
  const dateInput = dateInputWrap
    ? dateInputWrap.querySelector('input[type="text"]')
    : null;

  const timeWindowField = document.getElementById(
    "acff-post-field_681b23b73d2d2",
  );
  const expressCheckboxEl = document.getElementById(
    "acff-post-field_684c3ad580b60-Express",
  );
  const realExpressInput = document.querySelector(
    'input[name="acff[post][field_684c3ad580b60][]"][value="Express"]',
  );

  function alreadyHasExpress(items) {
    return items.some(
      (item) =>
        item?.code === "EXPRESS" ||
        (item?.group && item.group.some((g) => g.code === "EXPRESS")),
    );
  }

  function pushExpressOnce() {
    if (!alreadyHasExpress(rawBreakdown)) {
      rawBreakdown.push({
        label: "<strong>EXPRESS DELIVERY (EXPRESS)</strong>",
        price: 500,
        code: "EXPRESS",
      });
      total += 500;
    }
  }

  // 👇 If EXPRESS existed in saved HTML and the checkbox is visible but unchecked, re-sync it once
  const expressAlreadySaved = document
    .querySelector("#pricebreakdown")
    ?.innerHTML.includes("EXPRESS DELIVERY");
  const checkboxVisible = !!(
    expressCheckboxEl &&
    (expressCheckboxEl.offsetWidth || expressCheckboxEl.offsetParent)
  );
  if (
    !syncedExpressFromBreakdownOnce &&
    expressAlreadySaved &&
    checkboxVisible &&
    !expressCheckboxEl.checked
  ) {
    expressCheckboxEl.checked = true;
    if (realExpressInput) realExpressInput.checked = true;
    syncedExpressFromBreakdownOnce = true;
  }

  let shouldAutoExpress = false;

  if (dateInput) {
    const deliveryDay = parseACFDate(dateInput.value);
    if (deliveryDay) {
      // Base time uses order_created_at if present, else now (your existing behavior)
      const todayMid = new Date(
        baseTime.getFullYear(),
        baseTime.getMonth(),
        baseTime.getDate(),
      );
      const tomorrowMid = new Date(todayMid.getTime() + 24 * 60 * 60 * 1000);

      const isToday = deliveryDay.getTime() === todayMid.getTime();
      const isTomorrow = deliveryDay.getTime() === tomorrowMid.getTime();

      // Normalize timeframe info
      const tf = getTFInfo(timeWindowField);

      if (isToday) {
        // Rule 1 + “within 24h” goal → anything scheduled for today is < 24h
        // (covers ANY/NONE and also specific windows today)
        shouldAutoExpress = true;
      } else if (isTomorrow) {
        // Rule 2: tomorrow + (no timeframe OR Kontakt Kunde) → EXPRESS
        if (!tf.hasConcreteWindow || tf.isKontaktKunde || tf.isAnyOrNone) {
          shouldAutoExpress = true;
        } else {
          // Rule 3 & 4: tomorrow + concrete timeframe → compare start vs now
          const start = parseTimeWindowStart(tf.raw);
          if (start) {
            const startDT = new Date(
              deliveryDay.getFullYear(),
              deliveryDay.getMonth(),
              deliveryDay.getDate(),
              start.h,
              start.m,
            );
            const diffMs = startDT - baseTime;
            shouldAutoExpress = diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
          } else {
            // If we somehow don't parse a time, be conservative: no auto
            shouldAutoExpress = false;
          }
        }
      } else {
        // All other dates are ≥ 2 days away → not within 24h
        shouldAutoExpress = false;
      }
    }
  }

  // Respect manual override if user touched the checkbox
  const userChangedExpress = !!(
    expressCheckboxEl && expressCheckboxEl.dataset.userChanged === "true"
  );

  // Apply outcome:
  //  - If auto rule says EXPRESS, we add it unless user explicitly unchecked.
  //  - If checkbox is visible and untouched, we also sync it to checked for clarity.
  //  - If auto rule says no EXPRESS, we don't add it here (manual block below can still add/remove).
  if (shouldAutoExpress) {
    if (checkboxVisible) {
      if (!userChangedExpress) {
        expressCheckboxEl.checked = true;
        if (realExpressInput) realExpressInput.checked = true;
        pushExpressOnce();
      } else if (expressCheckboxEl.checked) {
        // user changed, but they WANT express → include it
        pushExpressOnce();
      }
      // user changed & unchecked → do nothing (honor manual override)
    } else {
      // Checkbox hidden → auto-apply
      pushExpressOnce();
    }
  }

  // ——— Extra: force add/remove EXPRESS if checkbox toggled ———
  if (expressCheckbox) {
    const alreadyAdded = rawBreakdown.some(
      (item) =>
        item.code === "EXPRESS" ||
        (item.group && item.group.some((g) => g.code === "EXPRESS")),
    );

    if (expressCheckbox.checked && !alreadyAdded) {
      rawBreakdown.push({
        label: "<strong>EXPRESS DELIVERY (EXPRESS)</strong>",
        price: 500,
        code: "EXPRESS",
      });
      total += 500;
    }

    if (!expressCheckbox.checked && alreadyAdded) {
      rawBreakdown = rawBreakdown
        .map((item) => {
          if (item.group) {
            const group = item.group.filter((sub) => sub.code !== "EXPRESS");
            return group.length ? { ...item, group } : null;
          }
          return item.code === "EXPRESS" ? null : item;
        })
        .filter(Boolean);
    }
  }
  if (hasTargetCode) {
    rawBreakdown = rawBreakdown.map((item) => {
      if (item.group) {
        const group = item.group.map((sub) => {
          if (sub.code === "DELIVERY") {
            return {
              label: formatLabel(sub.label, "XTRA"),
              price: 150,
              code: "XTRA",
            };
          } else if (sub.code === "INDOOR") {
            return {
              label: formatLabel(sub.label, "XTRA"),
              price: 229,
              code: "XTRA",
            };
          }
          return sub;
        });
        return { ...item, group };
      } else if (item.code === "DELIVERY") {
        return {
          label: formatLabel(item.label, "XTRA"),
          price: 150,
          code: "XTRA",
        };
      } else if (item.code === "INDOOR") {
        return {
          label: formatLabel(item.label, "XTRA"),
          price: 229,
          code: "XTRA",
        };
      }
      return item;
    });
  }

  if (totalKm > 100) {
    rawBreakdown = rawBreakdown.map((item) => {
      if (item.group) {
        const adjustedGroup = item.group.map((sub) => {
          if (["DELIVERY", "INDOOR", "XTRA"].includes(sub.code))
            return { ...sub, price: 0 };
          if (sub.code === "SIDEBYSIDE") return { ...sub, price: 710 };
          if (sub.code === "SIDEBYSIDETRAPP") return { ...sub, price: 409 };
          return sub;
        });
        return { ...item, group: adjustedGroup };
      } else {
        if (["DELIVERY", "INDOOR", "XTRA"].includes(item.code)) {
          return { ...item, price: 0 };
        }
        if (item.code === "SIDEBYSIDE") return { ...item, price: 710 };
        if (item.code === "SIDEBYSIDETRAPP") return { ...item, price: 409 };
        return item;
      }
    });
  }
  // 1) Ensure BOMTUR is part of the breakdown BEFORE discount
  const bomturSelect = document.querySelector(
    '.price-item select[name="acff[post][field_682e0baebb080]"]',
  );
  if (bomturSelect) {
    const price = parsePrice(bomturSelect.value);
    if (price > 0) {
      const { label, code } = parseLabelAndCode(bomturSelect.value);
      rawBreakdown.push({
        label: `<strong>${formatLabel(label, code)}</strong>`,
        price,
        code,
      });
    }
  }

  // 2) De-dup groups first so math matches what you display
  rawBreakdown = rawBreakdown.map((item) => {
    if (item.group) {
      const seen = new Set();
      const dedupedGroup = item.group.filter((sub) => {
        const key = sub.code + ":" + sub.label;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { ...item, group: dedupedGroup };
    }
    return item;
  });

  // 3) Compute subtotal from the *displayed* items
  const subtotal = rawBreakdown.reduce((sum, item) => {
    if (item.group)
      return sum + item.group.reduce((g, sub) => g + sub.price, 0);
    return sum + item.price;
  }, 0);

  // 4) Apply Rabatt and PLUS (pre-VAT). Clamp at 0.
  total = subtotal - manualDiscount + manualPlus;

  const breakdownEl = document.getElementById("pricebreakdown");
  const totalEl = document.getElementById("totalprice");
  // Flatten and clean each group to remove duplicate codes
  rawBreakdown = rawBreakdown.map((item) => {
    if (item.group) {
      const seen = new Set();
      const dedupedGroup = item.group.filter((sub) => {
        const key = sub.code + ":" + sub.label;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { ...item, group: dedupedGroup };
    }
    return item;
  });

  if (breakdownEl) {
    if (rawBreakdown.length) {
      breakdownEl.innerHTML = `
    
      <div class="price-breakdown-wrapper">
        ${rawBreakdown
          .map((item) => {
            if (item.group) {
              return `
              <div class="price-group">
                <div class="price-group-label"><strong>${item.label}</strong></div>
                ${item.group
                  .map(
                    (sub) => `
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">${sub.label}</span>
                    <span class="price-breakdown-price">${sub.price} NOK</span>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            `;
            } else {
              return `
              <div class="price-breakdown-row">
                <span class="price-breakdown-label">${item.label}</span>
                <span class="price-breakdown-price">${item.price} NOK</span>
              </div>
            `;
            }
          })
          .join("")}

        <hr style="margin: 12px 0; border-top: 2px solid black;">

        <div class="price-summary">
${
  manualDiscount > 0
    ? `
  <div class="price-breakdown-row">
    <span class="price-breakdown-label"><strong>Rabatt</strong></span>
    <span class="price-breakdown-price">- ${manualDiscount.toFixed(2)} NOK</span>
  </div>`
    : ""
}
${
  manualPlus > 0
    ? `
  <div class="price-breakdown-row">
    <span class="price-breakdown-label"><strong>Ekstra</strong></span>
    <span class="price-breakdown-price">+ ${manualPlus.toFixed(2)} NOK</span>
  </div>`
    : ""
}

          <div class="price-breakdown-row total-highlight" style="font-size: 1.6em; font-weight: bold;">
            <span class="price-breakdown-label"><strong>Total</strong></span>
            <span class="price-breakdown-price">${total.toFixed(2)} NOK</span>
          </div>

          ${
            total > 0
              ? `
            <div class="price-breakdown-row">
              <span class="price-breakdown-label">MVA (25%)</span>
              <span class="price-breakdown-price">${(total * 0.25).toFixed(2)} NOK</span>
            </div>
            <div class="price-breakdown-row">
              <span class="price-breakdown-label">Total inkl. MVA</span>
              <span class="price-breakdown-price">${(total * 1.25).toFixed(2)} NOK</span>
            </div>`
              : ""
          }
        </div>
      </div>`;
    } else {
      breakdownEl.innerHTML = `
    
      <div class="price-breakdown-wrapper">
        <hr style="margin: 12px 0; border-top: 2px solid black;">
        <div class="price-summary">
          <div class="price-breakdown-row total-highlight" style="font-size: 1.6em; font-weight: bold;">
            <span class="price-breakdown-label"><strong>Total</strong></span>
            <span class="price-breakdown-price">0.00 NOK</span>
          </div>
        </div>
      </div>`;
    }
  }

  if (totalEl) {
    totalEl.textContent = (total * 1.25).toFixed(2);
  }

  const vatEl = document.getElementById("totalvat");
  const withVatEl = document.getElementById("totalwithvat");
  if (vatEl) {
    const vat = total * 0.25;
    vatEl.textContent = vat.toFixed(2);
  }
  if (withVatEl) {
    const withVat = total * 1.25;
    withVatEl.textContent = withVat.toFixed(2);
  }

  // ✅ Injected ACF sync logic
  const totalWithVat = (total * 1.25).toFixed(2);
  const totalInput = document.getElementById("acff-post-field_6835ca43b0cfc");
  if (totalInput) {
    totalInput.value = total;
  }

  const breakdownTextarea = document.getElementById(
    "acff-post-field_6835ca7fb0cfd",
  );
  let savedBreakdownOnce = false;
  if (breakdownTextarea && breakdownEl && !savedBreakdownOnce) {
    const newValue = breakdownEl.innerHTML;

    breakdownTextarea.value = newValue;

    savedBreakdownOnce = true;
    generateSubcontractorBreakdown(rawBreakdown, totalKm);

    // ——— ALSO POPULATE order_created_at ONCE ———
    const createdEl = document.getElementById("acff-post-field_684feac9c43b7");
    if (createdEl && !savedCreatedOnce) {
      // format "YYYY-MM-DD HH:MM:00"
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const H = String(now.getHours()).padStart(2, "0");
      const M = String(now.getMinutes()).padStart(2, "0");
      const formatted = `${y}-${m}-${d} ${H}:${M}:00`;
      createdEl.value = formatted;
      console.log("🍕 [DEBUG] order_created_at auto-set to", formatted);
      savedCreatedOnce = true;
    }
  }
  setTimeout(() => {
    const discountOverride = document.querySelector(
      'input[name="acff[post][field_686e217030aaa]"]',
    );
    const breakdownEl = document.getElementById("pricebreakdown");

    if (
      !window.__discountAlreadyInjected &&
      discountOverride &&
      parseNOK(discountOverride.value) > 0 &&
      breakdownEl
    ) {
      window.__discountAlreadyInjected = true;
      window.dispatchEvent(new Event("discount-updated"));
    }
  }, 50);
}
