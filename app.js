async function getJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const servicesList = document.getElementById('servicesList');
const staffList = document.getElementById('staffList');
const appointmentsList = document.getElementById('appointmentsList');
const serviceSelect = document.getElementById('serviceSelect');
const staffSelect = document.getElementById('staffSelect');
const dateInput = document.getElementById('dateInput');
const timeSelect = document.getElementById('timeSelect');
const form = document.getElementById('bookingForm');
const formMessage = document.getElementById('formMessage');

async function loadServices() {
  const services = await getJson('/api/services');
  servicesList.innerHTML = services.map(service => `
    <div class="card">
      <h3>${service.name}</h3>
      <p class="small">${service.duration} min</p>
      <p class="small">${service.price} SEK</p>
    </div>
  `).join('');

  serviceSelect.innerHTML = services.map(service => `<option value="${service.id}">${service.name}</option>`).join('');
}

async function loadStaff() {
  const staff = await getJson('/api/staff');
  staffList.innerHTML = staff.map(person => `
    <div class="card">
      <h3>${person.name}</h3>
      <p class="small">Available for bookings</p>
    </div>
  `).join('');

  staffSelect.innerHTML = staff.map(person => `<option value="${person.id}">${person.name}</option>`).join('');
}

async function loadAppointments() {
  const appointments = await getJson('/api/appointments');
  appointmentsList.innerHTML = appointments.map(appt => `
    <div class="appointment">
      <strong>${appt.customerName}</strong>
      <div class="small">${appt.date} at ${appt.time}</div>
      <div class="small">Service: ${appt.serviceId}</div>
      <div class="small">Barber: ${appt.staffId}</div>
      <div class="small">Phone: ${appt.customerPhone || '-'}</div>
    </div>
  `).join('');
}

async function loadAvailability() {
  if (!dateInput.value) {
    timeSelect.innerHTML = '<option value="">Select a date first</option>';
    return;
  }

  const params = new URLSearchParams({
    date: dateInput.value,
    serviceId: serviceSelect.value,
    staffId: staffSelect.value
  });

  const data = await getJson(`/api/availability?${params.toString()}`);
  if (!data.slots.length) {
    timeSelect.innerHTML = '<option value="">No slots available</option>';
    return;
  }

  timeSelect.innerHTML = data.slots.map(slot => `<option value="${slot}">${slot}</option>`).join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = 'Creating booking...';
  formMessage.className = 'message';

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    await getJson('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    form.reset();
    formMessage.textContent = 'Booking created successfully.';
    formMessage.className = 'message success';
    await Promise.all([loadAppointments(), loadAvailability()]);
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.className = 'message error';
  }
});

serviceSelect.addEventListener('change', loadAvailability);
staffSelect.addEventListener('change', loadAvailability);
dateInput.addEventListener('change', loadAvailability);

async function init() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.value = tomorrow.toISOString().slice(0, 10);

  await Promise.all([loadServices(), loadStaff(), loadAppointments()]);
  await loadAvailability();
}

init().catch((error) => {
  formMessage.textContent = error.message;
  formMessage.className = 'message error';
});
