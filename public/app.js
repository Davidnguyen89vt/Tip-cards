const techSelect = document.getElementById('tech-select');
const actions = document.getElementById('actions');
const selectedName = document.getElementById('selected-name');
const venmoLink = document.getElementById('venmo-link');
const cashAppLink = document.getElementById('cashapp-link');
const statusEl = document.getElementById('status');

let technicians = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#9e1a1a' : '#4f4b45';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}

function renderDropdown() {
  const previous = techSelect.value;
  techSelect.innerHTML = '<option value="">Select technician</option>';

  technicians.forEach((tech) => {
    const option = document.createElement('option');
    option.value = tech.id;
    option.textContent = tech.name;
    techSelect.appendChild(option);
  });

  if (technicians.some((tech) => tech.id === previous)) {
    techSelect.value = previous;
  }

  updateActions();
}

function updateActions() {
  const selectedId = techSelect.value;
  const selectedTech = technicians.find((tech) => tech.id === selectedId);

  if (!selectedTech) {
    actions.classList.add('hidden');
    return;
  }

  selectedName.textContent = `Tip ${selectedTech.name}`;

  const hasVenmo = Boolean(selectedTech.venmo);
  const hasCashApp = Boolean(selectedTech.cashApp);

  venmoLink.href = hasVenmo ? selectedTech.venmo : '#';
  cashAppLink.href = hasCashApp ? selectedTech.cashApp : '#';

  venmoLink.classList.toggle('hidden', !hasVenmo);
  cashAppLink.classList.toggle('hidden', !hasCashApp);

  actions.classList.remove('hidden');
}

async function loadTechnicians() {
  try {
    setStatus('Loading technicians...');
    technicians = await api('/api/technicians');

    renderDropdown();
    if (!technicians.length) {
      setStatus('No technicians are configured yet.');
      return;
    }

    setStatus('Please select your technician.');
  } catch (_error) {
    setStatus('Unable to load technician list right now.', true);
  }
}

techSelect.addEventListener('change', updateActions);

loadTechnicians();
