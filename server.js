const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store onboarding/agent data in memory (in production, use a database)
const onboardingData = new Map();
const agents = [];

/**
 * Automates AI setup based on customer input
 * 
 * Input:
 * - company_number: The phone number for the AI receptionist
 * - company_name: Name of the company
 * - google_email: Optional Google account for calendar
 * 
 * Tasks:
 * 1. Create AI voice for the company
 * 2. Configure calendar if Google account provided
 * 3. Generate onboarding text for dashboard
 */
async function setupAIReceptionist({ company_number, company_name, google_email, timezone, reminder_hours, services }) {
  // Simulate AI voice creation (in production, integrate with ElevenLabs/Twilio)
  const voice_status = 'klar';
  
  // Configure calendar if Google account provided
  let calendar_status = 'ej konfigurerad';
  if (google_email) {
    // In production: OAuth flow + Google Calendar API
    // For now, simulate success
    calendar_status = 'klar';
  }
  
  // Parse services if provided
  const parsedServices = services 
    ? services.split('\n').filter(s => s.trim()).map(s => {
        const [name, duration] = s.split('-').map(p => p.trim());
        return { name: name || s.trim(), duration: parseInt(duration) || 30 };
      })
    : [];
  
  // Generate onboarding text
  const onboarding_text = `Din AI-receptionist för ${company_name} är redo! ` +
    `Den kommer svara på samtal till ${company_number} på svenska. ` +
    (google_email 
      ? `Kalender är kopplad till ${google_email} med påminnelser ${reminder_hours} timmar innan.` 
      : 'Koppla en Google-kalender i dashboarden för automatisk bokning.') +
    (parsedServices.length > 0 
      ? ` Tjänster: ${parsedServices.map(s => s.name).join(', ')}.` 
      : '');
  
  return {
    voice_status,
    calendar_status,
    onboarding_text,
    services: parsedServices
  };
}

// API endpoint for onboarding
app.post('/api/onboarding', async (req, res) => {
  try {
    const { 
      company_name, 
      company_email, 
      company_type,
      company_number, 
      forward_number,
      google_email,
      timezone = 'Europe/Stockholm',
      reminder_hours = 24,
      services 
    } = req.body;
    
    // Validate required fields
    if (!company_name || !company_email || !company_number) {
      return res.status(400).json({
        ok: false,
        error: 'Företagsnamn, e-post och telefonnummer krävs'
      });
    }
    
    // Generate unique customer ID
    const customerId = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Setup AI receptionist
    const result = await setupAIReceptionist({
      company_number,
      company_name,
      google_email,
      timezone,
      reminder_hours,
      services
    });
    
    // Store the onboarding data
    onboardingData.set(customerId, {
      company_name,
      company_email,
      company_type,
      company_number,
      forward_number,
      google_email,
      timezone,
      reminder_hours,
      services: result.services,
      voice_status: result.voice_status,
      calendar_status: result.calendar_status,
      created_at: new Date().toISOString()
    });
    
    console.log(`✅ New customer onboarded: ${company_name} (${company_number})`);
    
    res.json({
      ok: true,
      customer_id: customerId,
      voice_status: result.voice_status,
      calendar_status: result.calendar_status,
      onboarding_text: result.onboarding_text
    });
    
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({
      ok: false,
      error: 'Kunde inte slutföra konfigurationen. Försök igen senare.'
    });
  }
});

// Get onboarding status
app.get('/api/onboarding/:customerId', (req, res) => {
  const data = onboardingData.get(req.params.customerId);
  if (!data) {
    return res.status(404).json({ ok: false, error: 'Customer not found' });
  }
  res.json({ ok: true, ...data });
});

app.get('/api/agents', (_req, res) => {
  res.json({ ok: true, agents });
});

app.post('/api/agents/create', (req, res) => {
  const {
    salonName,
    ownerName,
    businessPhone,
    aiNumber,
    bookingUrl = '',
    instagram = '',
    notes = ''
  } = req.body || {};

  if (!salonName || !ownerName || !businessPhone || !aiNumber) {
    return res.status(400).json({
      ok: false,
      error: 'salonName, ownerName, businessPhone and aiNumber are required'
    });
  }

  const agent = {
    id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: 'active',
    salonName,
    ownerName,
    businessPhone,
    aiNumber,
    bookingUrl,
    instagram,
    notes,
    prompt: [
      `Du är AI-receptionisten för ${salonName}.`,
      `Ägare/Kontaktperson: ${ownerName}.`,
      `Salongens nummer: ${businessPhone}.`,
      `Ditt AI-nummer: ${aiNumber}.`,
      bookingUrl ? `Bokningslänk: ${bookingUrl}.` : null,
      instagram ? `Instagram: ${instagram}.` : null,
      notes ? `Extra instruktioner: ${notes}.` : null,
      'Svara alltid professionellt på svenska och hjälp kunden boka tid snabbt.'
    ].filter(Boolean).join(' '),
    routing: {
      inboundNumber: aiNumber,
      transferTo: businessPhone,
      smsConfirmations: true,
      calendarSync: true,
      provider: 'pending',
      webhook: '/voice/incoming',
      provisionedAt: null
    }
  };

  agents.push(agent);

  return res.status(201).json({
    ok: true,
    message: 'AI-agent skapad och aktiverad för test',
    agent
  });
});

app.post('/api/agents/:id/provision', (req, res) => {
  const agent = agents.find((a) => a.id === req.params.id);
  if (!agent) {
    return res.status(404).json({ ok: false, error: 'Agent not found' });
  }

  // Test provisioning simulation (replace with real Telnyx/Twilio call later)
  agent.status = 'provisioned';
  agent.routing.provider = 'telnyx';
  agent.routing.webhook = '/voice/incoming';
  agent.routing.provisionedAt = new Date().toISOString();

  return res.json({
    ok: true,
    message: 'Nummer provisionerat och webhook kopplad för test',
    agent
  });
});

app.post('/api/tts', async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({
        ok: false,
        error: 'OPENAI_API_KEY saknas på servern'
      });
    }

    const {
      text,
      voice = 'alloy',
      model = 'gpt-4o-mini-tts',
      format = 'mp3'
    } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ ok: false, error: 'text krävs' });
    }

    const audioResponse = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      format
    });

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    res.setHeader('Content-Type', format === 'wav' ? 'audio/wav' : 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(audioBuffer);
  } catch (error) {
    console.error('TTS error:', error?.message || error);
    return res.status(500).json({ ok: false, error: 'Kunde inte skapa TTS-ljud' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), agents: agents.length });
});

// Serve dashboard for logged-in users
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Automated Reception website running at http://localhost:${PORT}`);
});