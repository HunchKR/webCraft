const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const busboy = require('busboy');
const FormData = require('form-data');
const app = express();

// CORS 설정
app.use(cors({
  origin: 'https://webcraftpc.com',
  credentials: true
}));

// OPTIONS 프리플라이트 대응
app.options('/proxy/*', cors({
  origin: 'https://webcraftpc.com',
  credentials: true
}));

app.use(express.json());

// 공통 디버그 로깅 미들웨어
app.use('/proxy', (req, res, next) => {
  req.debugLog = {
    route: req.originalUrl,
    method: req.method,
    cookies: req.headers.cookie || null,
    requestBody: req.body || null,
    timestamp: new Date().toISOString()
  };
  console.log(`[프록시 요청] ${req.method} ${req.originalUrl}`, req.debugLog);
  next();
});

// 로그인
app.post('/proxy/login', async (req, res) => {
  try {
    const apiRes = await fetch('https://wc-piwm.onrender.com/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const setCookie = apiRes.headers.raw()['set-cookie'];
    if (setCookie) {
      setCookie.forEach(cookie => res.append('Set-Cookie', cookie));
      res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
    }
    const text = await apiRes.text();
    const isJson = apiRes.headers.get('content-type')?.includes('application/json');
    const data = isJson ? JSON.parse(text) : { message: text };
    req.debugLog.status = apiRes.status;
    req.debugLog.rawResponse = text;
    res.status(apiRes.status).json({ ...data, debugLog: req.debugLog });
  } catch (err) {
    req.debugLog.error = err.message;
    console.error('[프록시 오류 - 로그인]', req.debugLog);
    res.status(500).json({ message: '프록시 서버 오류', error: err.message, debugLog: req.debugLog });
  }
});

// 회원가입
app.post('/proxy/signUp', async (req, res) => {
  try {
    const apiRes = await fetch('https://wc-piwm.onrender.com/signUp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.cookie || ''
      },
      body: JSON.stringify(req.body)
    });
    const text = await apiRes.text();
    const isJson = apiRes.headers.get('content-type')?.includes('application/json');
    const data = isJson ? JSON.parse(text) : { message: text };
    req.debugLog.status = apiRes.status;
    req.debugLog.rawResponse = text;
    res.status(apiRes.status).json({ ...data, debugLog: req.debugLog });
  } catch (err) {
    req.debugLog.error = err.message;
    console.error('[프록시 오류 - 회원가입]', req.debugLog);
    res.status(500).json({ message: '프록시 서버 오류', error: err.message, debugLog: req.debugLog });
  }
});

// 맵 저장
app.post('/proxy/map/save', (req, res) => {
  const debugLog = req.debugLog;
  const bb = busboy({ headers: req.headers });
  const formData = new FormData();
  const filePromises = [];

  bb.on('file', (fieldname, file, info) => {
    const buffers = [];
    const promise = new Promise((resolve, reject) => {
      file.on('data', data => buffers.push(data));
      file.on('end', () => {
        formData.append(fieldname, Buffer.concat(buffers), {
          filename: info.filename,
          contentType: info.mimeType
        });
        debugLog.files = debugLog.files || [];
        debugLog.files.push({ fieldname, filename: info.filename, mimeType: info.mimeType });
        resolve();
      });
      file.on('error', reject);
    });
    filePromises.push(promise);
  });

  bb.on('field', (fieldname, value) => {
    formData.append(fieldname, value);
    debugLog.fields = debugLog.fields || {};
    debugLog.fields[fieldname] = value;
  });

  bb.on('close', async () => {
    try {
      await Promise.all(filePromises);
      const apiRes = await fetch('https://wc-piwm.onrender.com/map/save', {
        method: 'POST',
        headers: {
          ...formData.getHeaders(),
          cookie: req.headers.cookie || ''
        },
        body: formData
      });

      const text = await apiRes.text();
      const isJson = apiRes.headers.get('content-type')?.includes('application/json');
      const data = isJson ? JSON.parse(text) : { message: text };

      debugLog.status = apiRes.status;
      debugLog.rawResponse = text;

      res.status(apiRes.status).json({ ...data, debugLog });
    } catch (err) {
      debugLog.error = err.message;
      res.status(500).json({ message: '프록시 서버 오류', error: err.message, debugLog });
    }
  });

  req.pipe(bb);
});

// 맵 검색
app.post('/proxy/map/search', async (req, res) => {
  try {
    const apiRes = await fetch('https://wc-piwm.onrender.com/map/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.cookie || ''
      },
      body: JSON.stringify(req.body)
    });
    const text = await apiRes.text();
    const isJson = apiRes.headers.get('content-type')?.includes('application/json');
    const data = isJson ? JSON.parse(text) : { message: text };
    req.debugLog.status = apiRes.status;
    req.debugLog.rawResponse = text;
    res.status(apiRes.status).json({ ...data, debugLog: req.debugLog });
  } catch (err) {
    req.debugLog.error = err.message;
    res.status(500).json({ message: '프록시 서버 오류', error: err.message, debugLog: req.debugLog });
  }
});

// 맵 제공
app.post('/proxy/map/provide', async (req, res) => {
  try {
    const apiRes = await fetch('https://wc-piwm.onrender.com/map/provide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.cookie || ''
      },
      body: JSON.stringify(req.body)
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      return res.status(apiRes.status).json({ message: text, debugLog: req.debugLog });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    const disposition = apiRes.headers.get('content-disposition');
    if (disposition) res.setHeader('Content-Disposition', disposition);

    apiRes.body.pipe(res);
  } catch (err) {
    req.debugLog.error = err.message;
    res.status(500).json({ message: '프록시 서버 오류', error: err.message, debugLog: req.debugLog });
  }
});

// 맵 제거
app.post('/proxy/map/remove', async (req, res) => {
  try {
    const apiRes = await fetch('https://wc-piwm.onrender.com/map/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.cookie || ''
      },
      body: JSON.stringify(req.body)
    });

    const text = await apiRes.text();
    const isJson = apiRes.headers.get('content-type')?.includes('application/json');
    const data = isJson ? JSON.parse(text) : { message: text };
    req.debugLog.status = apiRes.status;
    req.debugLog.rawResponse = text;
    res.status(apiRes.status).json({ ...data, debugLog: req.debugLog });
  } catch (err) {
    req.debugLog.error = err.message;
    res.status(500).json({ message: '프록시 서버 오류', error: err.message, debugLog: req.debugLog });
  }
});

// 핑
app.get('/proxy/ping', (req, res) => {
  fetch('https://wc-piwm.onrender.com/ping', { method: 'HEAD', timeout: 5000 })
    .then(r => res.status(200).json({ proxy: 'online', backend: r.ok ? 'online' : 'offline' }))
    .catch(err => {
      console.error('[프록시 ping 오류]', err.message);
      res.status(200).json({ proxy: 'online', backend: 'offline' });
    });
});

app.all('/', (req, res) => res.status(200).send('Proxy server is live'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 프록시 서버 실행 중 (포트: ${PORT})`);
});
