require('dotenv').config();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors({
  origin: 'https://claramazzocchi.github.io'
}));

// === MODELLI ===
const PrenotazioneBrioche = mongoose.model('PrenotazioneBrioche', new mongoose.Schema({
  nome: String,
  numeroditelefono: String,
  data: String,
  orario: String,
  brioche: {
    type: [String],
    validate: [arr => arr.length <= 15, 'Puoi prenotare al massimo 15 brioche.']
  },
  dataCreazione: {
    type: Date,
    default: Date.now
  }
}));

const PrenotazioneTavolo = mongoose.model('PrenotazioneTavolo', new mongoose.Schema({
  nome: String,
  telefono: String,
  email: String,
  data: String,
  orario: String,
  persone: {
    type: Number,
    min: 1,
    max: 30
  },
  confermata: {
    type: Boolean,
    default: false
  },
  dataCreazione: {
    type: Date,
    default: Date.now
  }
}));

// === FUNZIONE PER PULIZIA PRENOTAZIONI VECCHIE ===
const eliminaPrenotazioniVecchie = async () => {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  try {
    await PrenotazioneBrioche.deleteMany({ data: { $lt: oggi.toISOString().split('T')[0] } });
    await PrenotazioneTavolo.deleteMany({ data: { $lt: oggi.toISOString().split('T')[0] } });
    console.log("Prenotazioni vecchie eliminate");
  } catch (error) {
    console.error("Errore durante l'eliminazione delle prenotazioni vecchie:", error);
  }
};

// === CONNESSIONE A MONGO ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connesso a MongoDB Atlas');
    eliminaPrenotazioniVecchie();
  })
  .catch((err) => {
    console.error('Errore di connessione a MongoDB:', err);
  });

// === EMAIL TRANSPORTER ===
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'clara.99mazzocchi@gmail.com',
    pass: 'yreh ejxp hwzu jjyg'
  }
});

// === ROUTE ===
app.get('/', (req, res) => res.send('Server attivo!'));

app.post('/prenota-brioche', async (req, res) => {
  const { nome, numeroditelefono, data, orario, brioche } = req.body;
  try {
    const nuovaPrenotazione = new PrenotazioneBrioche({ nome, numeroditelefono, data, orario, brioche });
    await nuovaPrenotazione.save();
    res.json({ messaggio: `Ciao ${nome}, la tua prenotazione è avvenuta con successo!` });
  } catch (error) {
    console.error("Errore:", error);
    res.status(500).json({ messaggio: "Errore durante la prenotazione." });
  }
});

app.post('/prenota-tavolo', async (req, res) => {
  const { nome, telefono, email, data, orario, persone } = req.body;
  try {
    const nuovaPrenotazione = new PrenotazioneTavolo({ nome, telefono, email, data, orario, persone });
    await nuovaPrenotazione.save();
    res.json({ messaggio: `Ciao ${nome}, la tua richiesta è stata inviata! Attendi conferma via e-mail.` });
  } catch (error) {
    console.error("Errore nel salvataggio della prenotazione tavolo:", error);
    res.status(500).json({ messaggio: "Errore durante la prenotazione." });
  }
});

app.get('/prenotazioni-brioche', async (req, res) => {
  try {
    const prenotazioni = await PrenotazioneBrioche.find().sort({ data: -1 });
    res.json(prenotazioni);
  } catch (error) {
    console.error("Errore nel recupero prenotazioni:", error);
    res.status(500).json({ messaggio: "Errore nel recupero delle prenotazioni." });
  }
});

app.get('/prenotazioni-tavoli', async (req, res) => {
  try {
    const prenotazioni = await PrenotazioneTavolo.find().sort({ dataCreazione: -1 });
    res.json(prenotazioni);
  } catch (error) {
    console.error("Errore caricamento:", error);
    res.status(500).json({ messaggio: "Errore nel recupero delle prenotazioni." });
  }
});

app.put('/prenotazioni-tavoli/:id', async (req, res) => {
  const { id } = req.params;
  const { confermata } = req.body;

  try {
    const prenotazione = await PrenotazioneTavolo.findByIdAndUpdate(id, { confermata }, { new: true });
    if (prenotazione && prenotazione.email) {
      await transporter.sendMail({
        from: 'clara.99mazzocchi@gmail.com',
        to: prenotazione.email,
        subject: confermata ? 'Conferma prenotazione tavolo' : 'Prenotazione rifiutata',
        text: confermata
          ? `Ciao ${prenotazione.nome}, la tua prenotazione per il ${prenotazione.data} alle ${prenotazione.orario} per ${prenotazione.persone} persone è stata CONFERMATA.`
          : `Ciao ${prenotazione.nome}, purtroppo la tua prenotazione per il ${prenotazione.data} alle ${prenotazione.orario} non può essere accettata.`
      });
    }

    res.json({ messaggio: "Prenotazione aggiornata e email inviata." });
  } catch (error) {
    console.error("Errore aggiornamento:", error);
    res.status(500).json({ messaggio: "Errore durante l'aggiornamento." });
  }
});

// === AVVIO SERVER ===
app.listen(PORT, () => {
  console.log(`Server in ascolto su http://localhost:${PORT}`);
});