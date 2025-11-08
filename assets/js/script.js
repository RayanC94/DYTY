/************ CONFIG A RENSEIGNER ************/
const SHEET_ID = "153ANvFAMR4Qy_g-qD9VlMChBmBEwWlJfEc5SRufhTX4";   // <-- colle l'ID du Google Sheet
const SHEET_NAME = "Stock";              // nom de l’onglet
/*********************************************/

const euro = new Intl.NumberFormat('fr-FR');
const toNum = (v, fb=0) => {
  if (!v) return fb;
  const s = String(v).replace(/[^0-9]/g, '');
  return s ? parseInt(s, 10) : fb;
};

// --- Google Drive helpers : transforme un lien de partage en lien <img> affichable
function extractDriveId(url){
  if(!url) return null;
  const m = String(url).match(/[-\w]{25,}/);
  return m ? m[0] : null;
}
function driveEmbed(url){
  if(!url) return "";
  if(url.includes("uc?export=view&id=")) return url; // déjà ok
  const id = extractDriveId(url);
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : url;
}

// --- Charge via GViz (pas d’API key)
async function fetchSheetCars() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  const json = JSON.parse(text.replace(/^[^{]+/, '').replace(/[^}]+$/, ''));
  const cols = json.table.cols.map(c => (c.label || '').trim().toLowerCase());
  const rows = json.table.rows.map(r => r.c.map(c => c ? c.v : null));

  const cars = rows.map(arr => {
    const obj = {};
    cols.forEach((key, i) => obj[key] = arr[i]);

    // Normalisation standard
    obj.id = toNum(obj.id);
    obj.make = (obj.make || '').trim();
    obj.model = (obj.model || '').trim();
    obj.year = toNum(obj.year, null);
    obj.km = toNum(obj.km, 0);
    obj.origin = (obj.origin || '').trim();

    obj.price = toNum(obj.price, 0);
    obj.maintenance_price = toNum(obj.maintenance_price, 0);
    obj.price_total = toNum(obj.price_total, 0) || (obj.price + obj.maintenance_price) || 0;

    obj.ct_valid_until = (obj.ct_valid_until || '').trim();
    obj.owners_count = toNum(obj.owners_count, null);
    obj.engine = (obj.engine || '').trim();
    obj.power_hp = toNum(obj.power_hp, null);
    obj.fiscal_power_cv = toNum(obj.fiscal_power_cv, null);
    obj.gearbox = (obj.gearbox || '').trim();
    obj.fuel = (obj.fuel || '').trim();
    obj.color = (obj.color || '').trim();
    obj.body = (obj.body || '').trim();
    obj.critair = (obj.critair || '').trim();
    obj.euro_norm = (obj.euro_norm || '').trim();
    obj.consumption_mix = (obj.consumption_mix || '').toString().trim();
    obj.co2 = toNum(obj.co2, null);

    obj.ac = (obj.ac || '').toString().toLowerCase();
    obj.heated_seats = (obj.heated_seats || '').toString().toLowerCase();
    obj.electric_windows = (obj.electric_windows || '').toString().toLowerCase();
    obj.cruise_control = (obj.cruise_control || '').toString().toLowerCase();
    obj.spare_keys = (obj.spare_keys || '').toString().toLowerCase();

    obj.notes = (obj.notes || '').trim();
    obj.km_history = (obj.km_history || '').trim();

    obj.images = (obj.images || "")
      .split('|')
      .map(s => driveEmbed((s || '').trim()))
      .filter(Boolean);

    obj.lbc_url = (obj.lbc_url || '').trim();
    obj.status = (obj.status || '').trim().toLowerCase(); // disponible / réservé / vendu
    obj.highlight = (obj.highlight || '').toString().toLowerCase() === 'oui';

    return obj;
  }).filter(v => v.id && v.make && v.model);

  return cars;
}

/* ============ LISTE & FILTRES ============ */
function renderList(cars) {
  const grid = document.getElementById('vehicleGrid');
  if (!grid) return;
  grid.innerHTML = '';

  cars.forEach(v => {
    const img = (v.images && v.images[0]) ? v.images[0] : '';
    const sold = v.status === 'vendu';
    const art = document.createElement('article');
    art.className = 'car-card';
    art.dataset.id = v.id;
    art.dataset.make = v.make.toLowerCase();
    art.dataset.model = v.model.toLowerCase();
    art.dataset.year = v.year || '';
    art.dataset.km = v.km || '';
    art.dataset.price = v.price_total || v.price || '';

    art.innerHTML = `
      <a class="card-link" href="details.html?id=${v.id}" aria-label="Voir détails ${v.make} ${v.model}">
        <img src="${img}" alt="${v.make} ${v.model}">
        ${sold ? '<div class="badge-sold">Vendu</div>' : ''}
      </a>
      <div class="car-body">
        <h3><a href="details.html?id=${v.id}">${v.make} ${v.model}</a></h3>
        <p>${v.year || ''} • ${v.km ? euro.format(v.km) + ' km' : ''} ${v.origin ? '• ' + v.origin : ''}</p>
        <div class="price">${(v.price_total || v.price) ? euro.format(v.price_total || v.price) + ' €' : ''}</div>
        <a class="btn-outline" href="details.html?id=${v.id}">Voir détails</a>
      </div>
    `;
    grid.appendChild(art);
  });
}

function initFilters(allCars) {
  const q = document.getElementById('q');
  const marque = document.getElementById('marque');
  const trier = document.getElementById('trier');
  const minP = document.getElementById('minPrice');
  const maxP = document.getElementById('maxPrice');
  const reset = document.getElementById('resetFilters');

  function apply() {
    let cars = [...allCars];
    const text = (q?.value || '').toLowerCase().trim();
    const brand = (marque?.value || '').toLowerCase().trim();
    const min = toNum(minP?.value, 0);
    const max = toNum(maxP?.value, 999999999);

    cars = cars.filter(v => {
      const make = (v.make || '').toLowerCase();
      const model = (v.model || '').toLowerCase();
      const totalPrice = v.price_total || v.price || 0;

      const okText = !text || make.includes(text) || model.includes(text);
      const okBrand = !brand || make === brand;
      const okPrice = totalPrice >= min && totalPrice <= max;

      // On n’affiche pas les vendus (facultatif : retire cette ligne si tu veux qu’ils restent visibles)
      const okStatus = v.status !== 'vendu';

      return okText && okBrand && okPrice && okStatus;
    });

    cars.sort((a,b) => {
      switch(trier?.value) {
        case 'price-asc': return (a.price_total||a.price||0) - (b.price_total||b.price||0);
        case 'price-desc': return (b.price_total||b.price||0) - (a.price_total||a.price||0);
        case 'year-desc': return (b.year||0) - (a.year||0);
        case 'km-asc': return (a.km||0) - (b.km||0);
        default: return 0;
      }
    });

    renderList(cars);
  }

  ['input','change','keyup'].forEach(ev => [q,marque,trier,minP,maxP].forEach(el => el && el.addEventListener(ev, apply)));
  reset && reset.addEventListener('click', () => {
    if(q) q.value=''; if(marque) marque.value=''; if(trier) trier.value='';
    if(minP) minP.value=''; if(maxP) maxP.value='';
    apply();
  });
  apply();
}

async function initList() {
  try {
    const cars = await fetchSheetCars();
    window.CARS = cars;
    renderList(cars);
    initFilters(cars);
  } catch(e) {
    console.error('Chargement Google Sheet échoué :', e);
    alert("Impossible de charger le stock depuis Google Sheets. Vérifie l'ID et le partage en lecture.");
  }
}

/* ============ DÉTAILS ============ */
window.initVehicleDetails = async function () {
  try {
    if (!window.CARS) window.CARS = await fetchSheetCars();
    const id = parseInt(new URLSearchParams(location.search).get('id') || '0', 10);
    const v = window.CARS.find(c => c.id === id);
    if (!v) return;

    const imgEl = document.getElementById('carImg');
    const thumbs = document.getElementById('thumbs');
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // Images
    if (imgEl) imgEl.src = (v.images && v.images[0]) ? v.images[0] : '';
    if (thumbs && Array.isArray(v.images)) {
      thumbs.innerHTML = '';
      v.images.forEach(src => {
        const im = document.createElement('img');
        im.src = src; im.alt = 'Miniature';
        im.addEventListener('click', () => { if(imgEl) imgEl.src = src; });
        thumbs.appendChild(im);
      });
    }

    // Titres / infos
    setText('title', `${v.make} ${v.model}`);
    setText('subtitle', `${v.year || ''} • ${v.km ? euro.format(v.km) + ' km' : ''} ${v.origin ? '• ' + v.origin : ''}`);

    const total = v.price_total || ( (v.price||0) + (v.maintenance_price||0) );
    const elPrice = document.getElementById('price');
    if (elPrice) elPrice.textContent = total ? `${euro.format(total)} €` : (v.price ? `${euro.format(v.price)} €` : '—');

    setText('engine', v.engine || '—');
    setText('gearbox', v.gearbox || '—');
    setText('fuel', v.fuel || '—');
    setText('color', v.color || '—');
    setText('owner', (v.owners_count != null) ? String(v.owners_count) : (v.owner || '—'));

    // Compléments
    const elCt = document.getElementById('ct');
    if (elCt && v.ct_valid_until) elCt.textContent = `Contrôle technique valable jusqu’à ${v.ct_valid_until}`;

    const elMaint = document.getElementById('maintenance');
    if (elMaint && (v.maintenance_price || v.notes)) {
      const prixEnt = v.maintenance_price ? `Entretien prévu : ${euro.format(v.maintenance_price)} €` : '';
      const note = v.notes ? ` • ${v.notes}` : '';
      elMaint.textContent = `${prixEnt}${note}`.replace(/^ • /,'');
    }

    const elHist = document.getElementById('km_history');
    if (elHist && v.km_history) elHist.textContent = v.km_history;

    // Bouton Leboncoin
    const btnLbc = document.getElementById('btnLbc');
    if (btnLbc && v.lbc_url) {
      btnLbc.href = v.lbc_url;
      btnLbc.style.display = 'inline-flex';
    }
  } catch(e) {
    console.error(e);
    alert("Impossible d’afficher la fiche véhicule.");
  }
};

// Auto-init liste si on est sur l’index
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('vehicleGrid')) initList();
});
