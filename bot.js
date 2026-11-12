const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
// 1. ВСТАВЬ СЮДА СВОИ ДАННЫЕ
const TOKEN = '9017961379:AAH1uQEJ4Txc5o89OUlFi0TMqo0WpAIhY14';
const WEB_APP_URL = 'https://sites.google.com/view/rogbarber/full-page-embed/'; // Ссылка на твой виджет Netlify

// 2. БАЗА ДАННЫХ ID (Кто есть кто)
const OWNER_ID = 564704489; // Вставь свой личный ID (узнай в @getmyid_bot)
const MASTERS = {
  '1': 536367354, // Личный ID Никиты Рогова
  '2': 6613083688, // Личный ID Максима Белова
  '3': 444444444  // Личный ID Дмитрия Волкова
};
// Подключение к базе данных MongoDB
const MONGODB_URI = 'mongodb+srv://alexongod_db_user:LASyPhoAPxm1oI1m@rogdata.ldhqx9k.mongodb.net/rog_crm?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ База данных MongoDB успешно подключена!'))
  .catch(err => console.error('❌ Ошибка подключения к базе:', err));
  // Шаблон заявки для базы данных
const bookingSchema = new mongoose.Schema({
  masterId: String,
  masterName: String,
  name: String,
  phone: String,
  date: String,
  time: String,
  services: [String],
  total: Number,
  status: { type: String, default: 'ожидает' }, // пригодится для кнопок "подтвердить/отменить"
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model('Booking', bookingSchema);
// Инициализация бота и сервера
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// ЛОГИКА РОЛЕЙ: ЧТО ВИДИТ ПОЛЬЗОВАТЕЛЬ ПРИ СТАРТЕ
// ==========================================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (chatId === OWNER_ID) {
    // МЕНЮ ВЛАДЕЛЬЦА
    bot.sendMessage(chatId, '👑 Добро пожаловать в панель владельца "РОГ".', {
      reply_markup: {
        keyboard: [
          ['📊 Статистика за день', '👥 Все записи'],
          ['⚙️ Настройки бота']
        ],
        resize_keyboard: true
      }
    });

  } else if (Object.values(MASTERS).map(String).includes(String(chatId))) {
    // МЕНЮ МАСТЕРА
    bot.sendMessage(chatId, '✂️ Привет, мастер! Вот твоя рабочая панель.', {
      reply_markup: {
        keyboard: [
          ['📋 Мое расписание на сегодня']
        ],
        resize_keyboard: true
      }
    });

  } else {
    // МЕНЮ КЛИЕНТА
    bot.sendMessage(chatId, 'Добро пожаловать в барбершоп РОГ Сочи! 👋\n\nВыберите мастера и удобное время прямо здесь:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗓 Записаться онлайн', web_app: { url: WEB_APP_URL } }]
        ]
      }
    });
  }
});

// Обработка всех текстовых сообщений (нажатий на кнопки)
// Обработка всех текстовых сообщений (нажатий на кнопки)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Игнорируем сообщения без текста (например, фото или стикеры) и команду /start
  if (!text || text === '/start') return;

  // 1. ЛОГИКА АДМИНА (ВЛАДЕЛЬЦА)
  if (chatId == OWNER_ID) {
    if (text.includes('Статистика за день')) {
      bot.sendMessage(chatId, '📊 *Статистика за сегодня*\n\nНовых записей: 0\nСумма: 0 руб.\n\n_(Скоро мы привяжем сюда реальные цифры)_', { parse_mode: 'Markdown' });
    } 
    else if (text.includes('Все записи')) {
      bot.sendMessage(chatId, '👥 *Список записей*\n\nЗдесь будет выводиться расписание на ближайшие дни.', { parse_mode: 'Markdown' });
    }
    else if (text.includes('Настройки бота')) {
      bot.sendMessage(chatId, '⚙️ *Настройки*\n\nРаздел в разработке.', { parse_mode: 'Markdown' });
    }
  }

  // 2. ЛОГИКА МАСТЕРОВ
  const isMaster = Object.values(MASTERS).includes(chatId.toString());

  if (isMaster) {
    // Используем .includes(), чтобы бот смотрел только на буквы, игнорируя смайлики
    if (text.includes('Мое расписание на сегодня')) {
      try {
        const today = new Date();
        const options = { day: 'numeric', month: 'short' };
        const todayString = today.toLocaleDateString('ru-RU', options).replace('.', ''); 

        const masterId = Object.keys(MASTERS).find(key => MASTERS[key] === chatId.toString());
        const bookings = await getMasterBookingsByDate(masterId, todayString);

        if (!bookings || bookings.length === 0) {
          bot.sendMessage(chatId, `На сегодня (${todayString}) записей пока нет. Отдыхай! ☕`);
        } else {
          let replyText = `📅 *Твои записи на сегодня (${todayString}):*\n\n`;
          bookings.forEach((b, index) => {
            replyText += `${index + 1}. ⏰ *${b.time}* - ${b.name}\n`;
            replyText += `   📞 ${b.phone}\n`;
            replyText += `   ✂️ Услуги: ${b.services.join(', ')}\n`; 
            replyText += `   💰 Сумма: ${b.total} руб.\n`;
            replyText += `   Статус: _${b.status}_\n\n`;
          });
          bot.sendMessage(chatId, replyText, { parse_mode: 'Markdown' });
        }
      } catch (error) {
        // Если что-то сломается внутри сервера, бот пришлет ошибку прямо в чат!
        bot.sendMessage(chatId, '❌ Произошла ошибка: ' + error.message);
      }
    }
    else if (text.includes('Календарь') || text.includes('Моя история')) {
       bot.sendMessage(chatId, 'Раздел в разработке 🛠️');
    }
  }
});



// ==========================================
// API: ПРИЕМ ЗАЯВОК С ВИДЖЕТА И МАРШРУТИЗАЦИЯ
// ==========================================
app.post('/api/booking', async (req, res) => {
  const { masterId, masterName, name, phone, date, time, services, total } = req.body;
  try {
    // Создаем новую запись по нашему шаблону
    const newBooking = new Booking({
      masterId: masterId,
      masterName: masterName,
      name: name,
      phone: phone,
      date: date,
      time: time,
      services: services,
      total: total
    });
    
    // Сохраняем в MongoDB
    await newBooking.save();
    console.log('✅ Новая запись успешно сохранена в базу!');
  } catch (error) {
    console.error('❌ Ошибка при сохранении в базу:', error);
  }
  const tgMessage = `🔥 *Новая запись (РОГ Сочи)*\n\n👤 *Имя:* ${name}\n📞 *Телефон:* ${phone}\n\n✂️ *Мастер:* ${masterName}\n📋 *Дата:* ${date}, ${time}\n📋 *Услуги:* ${services.join(', ')}\n💰 *Сумма:* ${total} ₽`;

  // 1. Всегда отправляем копию владельцу
  bot.sendMessage(OWNER_ID, tgMessage, { parse_mode: 'Markdown' }).catch(console.error);

  // 2. Отправляем лично выбранному мастеру
  const specificMasterTgId = MASTERS[masterId];
  if (specificMasterTgId) {
    bot.sendMessage(specificMasterTgId, tgMessage, { parse_mode: 'Markdown' }).catch(console.error);
  }

  res.json({ success: true });
});

// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Сервер CRM запущен на порту ${PORT}. Бот готов к работе!`);
});
