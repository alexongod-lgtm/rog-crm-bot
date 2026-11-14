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
          ['📋 Мое расписание на сегодня'],
          ['📆 Календарь', '📊 Моя история']
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

// Функция для получения записей мастера на конкретную дату
async function getMasterBookingsByDate(masterId, dateString) {
  try {
    // Ищем в базе записи, где совпадают masterId и date
    const bookings = await Booking.find({ masterId: masterId, date: dateString });
    return bookings;
  } catch (error) {
    console.error('Ошибка при поиске записей в базе:', error);
    return []; // В случае ошибки возвращаем пустой список
  }
}


// Генерация ближайших 7 дней по МСК для календаря в боте
function getNext7DaysMsk() {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const result = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = `${d.getDate()} ${months[d.getMonth()]}`;
    const label = i === 0 ? `Сегодня (${dateStr})` : `${days[d.getDay()]}, ${dateStr}`;
    result.push({ dateStr, label });
  }
  return result;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  console.log(`[DEBUG] Получено сообщение от ${chatId}: ${text}`); 
  const isMaster = Object.values(MASTERS).map(id => id.toString()).includes(chatId.toString());
  console.log(`[DEBUG] Пользователь ${chatId} является мастером: ${isMaster}`);

  // Игнорируем сообщения без текста (например, фото или стикеры) и команду /start
  if (!text || text === '/start') return;

  // 1. ЛОГИКА АДМИНА (ВЛАДЕЛЬЦА)
  if (String(chatId) === String(OWNER_ID)) {
    
    // Кнопка: Статистика за день (и общая выручка по мастерам)
    if (text.includes('Статистика за день') || text.includes('Статистика и выручка')) {
      try {
        const todayStr = getNext7DaysMsk()[0].dateStr;
        const todayBookings = await Booking.find({ date: todayStr });
        const allBookings = await Booking.find({});

        const todaySum = todayBookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
        const totalSum = allBookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0);

        const byMaster = {};
        allBookings.forEach(b => {
          const mName = b.masterName || b.masterId || 'Не указан';
          if (!byMaster[mName]) byMaster[mName] = { count: 0, sum: 0 };
          byMaster[mName].count += 1;
          byMaster[mName].sum += Number(b.total) || 0;
        });

        let statText = `📊 *Статистика за сегодня (${todayStr}):*\n`;
        statText += `👥 Записей сегодня: *${todayBookings.length}*\n`;
        statText += `💵 Выручка за день: *${todaySum.toLocaleString('ru-RU')} ₽*\n\n`;
        statText += `📈 *За всё время:*\n`;
        statText += `🧾 Всего записей: *${allBookings.length}* на *${totalSum.toLocaleString('ru-RU')} ₽*\n\n`;
        statText += `💈 *По мастерам:*\n`;

        for (const [mName, info] of Object.entries(byMaster)) {
          statText += `• *${mName}*: ${info.count} зап. (*${info.sum.toLocaleString('ru-RU')} ₽*)\n`;
        }

        return bot.sendMessage(chatId, statText, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error(err);
        return bot.sendMessage(chatId, '❌ Ошибка подсчета статистики.');
      }
    }

    // Кнопка: Все записи (открывает интерактивный календарь на 7 дней по всем мастерам)
    if (text.includes('Все записи') || text.includes('Общий календарь')) {
      const nextDays = getNext7DaysMsk();
      const inlineKeyboard = [];

      for (let i = 0; i < nextDays.length; i += 2) {
        const row = [{ text: nextDays[i].label, callback_data: `ocal_${nextDays[i].dateStr}` }];
        if (nextDays[i + 1]) {
          row.push({ text: nextDays[i + 1].label, callback_data: `ocal_${nextDays[i + 1].dateStr}` });
        }
        inlineKeyboard.push(row);
      }

      return bot.sendMessage(chatId, '📅 *Общий календарь барбершопа «РОГ»*\nВыбери день для просмотра всех записей:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    }

    // Кнопка: Настройки бота (быстрая сводка по системе)
    if (text.includes('Настройки бота')) {
      let settingsText = `⚙️ *Настройки системы «РОГ»:*\n\n`;
      settingsText += `👑 Твой ID владельца: \`${OWNER_ID}\`\n`;
      settingsText += `💈 Подключенные мастера в коде:\n`;
      for (const [mKey, mTgId] of Object.entries(MASTERS)) {
        settingsText += `• ID мастера *${mKey}*: \`${mTgId}\`\n`;
      }
      return bot.sendMessage(chatId, settingsText, { parse_mode: 'Markdown' });
    }
  }

  // 2. ЛОГИКА МАСТЕРОВ
  if (isMaster) {
    // Определяем ID мастера (например, 'm1', 'm2') по его Telegram chatId
    const masterId = Object.keys(MASTERS).find(key => String(MASTERS[key]) === String(chatId));

    // --- КНОПКА 1: МОЕ РАСПИСАНИЕ НА СЕГОДНЯ ---
    if (text.includes('Мое расписание на сегодня')) {
      const todayStr = getNext7DaysMsk()[0].dateStr;
      try {
        const bookings = await Booking.find({ masterId: masterId, date: todayStr });
        bookings.sort((a, b) => a.time.localeCompare(b.time));

        if (bookings.length === 0) {
          return bot.sendMessage(chatId, `📅 На сегодня (*${todayStr}*) у тебя записей пока нет. Свободный день! 😎`, { parse_mode: 'Markdown' });
        }

        let responseText = `📅 *Твое расписание на сегодня (${todayStr}):*\n\n`;
        bookings.forEach((b, i) => {
          const servicesList = Array.isArray(b.services) ? b.services.join(', ') : b.services;
          responseText += `${i + 1}. 🕒 *${b.time}* — ${b.name}\n`;
          responseText += `📞 ${b.phone}\n`;
          responseText += `✂️ ${servicesList}\n`;
          responseText += `💰 ${b.total} ₽\n\n`;
        });

        return bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error('Ошибка расписания на сегодня:', err);
        return bot.sendMessage(chatId, '❌ Ошибка при загрузке расписания.');
      }
    }

    // --- КНОПКА 2: КАЛЕНДАРЬ МАСТЕРА ---
    if (text.includes('Календарь')) {
      const nextDays = getNext7DaysMsk();
      const inlineKeyboard = [];

      for (let i = 0; i < nextDays.length; i += 2) {
        const row = [{
          text: nextDays[i].label,
          callback_data: `mcal_${masterId}_${nextDays[i].dateStr}`
        }];
        if (nextDays[i + 1]) {
          row.push({
            text: nextDays[i + 1].label,
            callback_data: `mcal_${masterId}_${nextDays[i + 1].dateStr}`
          });
        }
        inlineKeyboard.push(row);
      }

      return bot.sendMessage(chatId, '📅 Выбери день, чтобы посмотреть записи:', {
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    }

    // --- КНОПКА 3: МОЯ ИСТОРИЯ И СТАТИСТИКА ---
    if (text.includes('Моя история')) {
      try {
        const allBookings = await Booking.find({ masterId: masterId });
        if (allBookings.length === 0) {
          return bot.sendMessage(chatId, '📊 У тебя пока нет записей в базе.');
        }

        const totalRevenue = allBookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
        const recent = allBookings.slice(-10).reverse();

        let msgText = `📊 *Твоя статистика за всё время:*\n`;
        msgText += `👥 Всего записей: *${allBookings.length}*\n`;
        msgText += `💰 Общая сумма: *${totalRevenue.toLocaleString('ru-RU')} ₽*\n\n`;
        msgText += `🕒 *Последние записи:*\n`;

        recent.forEach((b, idx) => {
          msgText += `${idx + 1}. *${b.date} в ${b.time}* — ${b.name} (${b.total} ₽)\n`;
        });

        return bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error('Ошибка получения истории мастера:', err);
        return bot.sendMessage(chatId, '❌ Ошибка при загрузке истории.');
      }
    }
  }
});


// ==========================================
// API: ПРИЕМ ЗАЯВОК С ВИДЖЕТА И МАРШРУТИЗАЦИЯ
// ==========================================

// API: ОТДАЕМ ЗАНЯТЫЕ ЧАСЫ ДЛЯ ВИДЖЕТА
app.get('/api/booked-times', async (req, res) => {
  const { masterId, date } = req.query;
  if (!masterId || !date) return res.json({ bookedTimes: [] });

  try {
    // Ищем все записи конкретного мастера на выбранную дату
    const bookings = await Booking.find({ masterId: masterId, date: date });
    // Собираем только время из этих записей (например, ['14:00', '18:30'])
    const bookedTimes = bookings.map(b => b.time); 
    
    res.json({ bookedTimes: bookedTimes });
  } catch (error) {
    console.error('Ошибка получения занятых часов:', error);
    res.status(500).json({ bookedTimes: [] });
  }
});

app.post('/api/booking', async (req, res) => {
  const { masterId, masterName, name, phone, date, time, services, total } = req.body;
  try {

    // --- 🛑 НОВАЯ ПРОВЕРКА НА ДВОЙНУЮ ЗАПИСЬ ---
    const existingBooking = await Booking.findOne({ 
      masterId: masterId, 
      date: date, 
      time: time 
    });

    if (existingBooking) {
      console.log(`[ОТКАЗ] Попытка двойной записи: Мастер ${masterId}, ${date} в ${time}`);
      // Прерываем работу и отправляем виджету ошибку
      return res.status(400).json({ 
        success: false, 
        message: 'К сожалению, это время только что заняли. Пожалуйста, выберите другое.' 
      });
    }
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

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  // --- КЛИК ПО ДАТЕ В ОБЩЕМ КАЛЕНДАРЕ ВЛАДЕЛЬЦА ---
  if (data.startsWith('ocal_') && data !== 'ocal_back') {
    const dateStr = data.replace('ocal_', '');

    try {
      const bookings = await Booking.find({ date: dateStr });
      bookings.sort((a, b) => a.time.localeCompare(b.time));

      let responseText = `📅 *Все записи барбершопа на ${dateStr}:*\n\n`;
      let daySum = 0;

      if (bookings.length === 0) {
        responseText += `На этот день записей пока нет.`;
      } else {
        bookings.forEach((b, i) => {
          daySum += Number(b.total) || 0;
          const servicesList = Array.isArray(b.services) ? b.services.join(', ') : b.services;
          responseText += `${i + 1}. 🕒 *${b.time}* — 💈 *${b.masterName || b.masterId}*\n`;
          responseText += `👤 ${b.name} (${b.phone})\n`;
          responseText += `✂️ ${servicesList} — *${b.total} ₽*\n\n`;
        });
        responseText += `💵 *Сумма за день: ${daySum.toLocaleString('ru-RU')} ₽*`;
      }

      const backKeyboard = [[{ text: '🔙 Назад к датам', callback_data: 'ocal_back' }]];

      await bot.editMessageText(responseText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: backKeyboard }
      });
    } catch (err) {
      console.error('Ошибка общего календаря:', err);
    }
    return bot.answerCallbackQuery(query.id);
  }

  // --- ВОЗВРАТ К ДАТАМ В ОБЩЕМ КАЛЕНДАРЕ ВЛАДЕЛЬЦА ---
  if (data === 'ocal_back') {
    const nextDays = getNext7DaysMsk();
    const inlineKeyboard = [];

    for (let i = 0; i < nextDays.length; i += 2) {
      const row = [{ text: nextDays[i].label, callback_data: `ocal_${nextDays[i].dateStr}` }];
      if (nextDays[i + 1]) {
        row.push({ text: nextDays[i + 1].label, callback_data: `ocal_${nextDays[i + 1].dateStr}` });
      }
      inlineKeyboard.push(row);
    }

    await bot.editMessageText('📅 *Общий календарь барбершопа*\nВыбери день для просмотра всех записей:', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
    return bot.answerCallbackQuery(query.id);
  }

  // Клик по дате в календаре мастера: mcal_ID_ДАТА
  if (data.startsWith('mcal_') && !data.startsWith('mcal_back_')) {
    const [, masterId, dateStr] = data.split('_');

    try {
      const bookings = await Booking.find({ masterId: masterId, date: dateStr });
      bookings.sort((a, b) => a.time.localeCompare(b.time));

      let responseText = `📅 *Расписание на ${dateStr}:*\n\n`;

      if (bookings.length === 0) {
        responseText += `Записей на этот день пока нет. Свободный день! 😎`;
      } else {
        bookings.forEach((b, i) => {
          const servicesList = Array.isArray(b.services) ? b.services.join(', ') : b.services;
          responseText += `${i + 1}. 🕒 *${b.time}* — ${b.name}\n`;
          responseText += `📞 ${b.phone}\n`;
          responseText += `✂️ ${servicesList}\n`;
          responseText += `💰 ${b.total} ₽ | Статус: ${b.status || 'ожидает'}\n\n`;
        });
      }

      // Кнопка возврата к списку дат
      const backKeyboard = [[{ text: '🔙 Назад к выбору даты', callback_data: `mcal_back_${masterId}` }]];

      await bot.editMessageText(responseText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: backKeyboard }
      });
    } catch (err) {
      console.error('Ошибка календаря:', err);
    }
    return bot.answerCallbackQuery(query.id);
  }

  // Возврат к сетке дат календаря
  if (data.startsWith('mcal_back_')) {
    const masterId = data.replace('mcal_back_', '');
    const nextDays = getNext7DaysMsk();
    const inlineKeyboard = [];

    for (let i = 0; i < nextDays.length; i += 2) {
      const row = [{ text: nextDays[i].label, callback_data: `mcal_${masterId}_${nextDays[i].dateStr}` }];
      if (nextDays[i + 1]) {
        row.push({ text: nextDays[i + 1].label, callback_data: `mcal_${masterId}_${nextDays[i + 1].dateStr}` });
      }
      inlineKeyboard.push(row);
    }

    await bot.editMessageText('📅 Выбери день, чтобы посмотреть записи:', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
    return bot.answerCallbackQuery(query.id);
  }
});

// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Сервер CRM запущен на порту ${PORT}. Бот готов к работе!`);
});
