import crypto from 'crypto';
import QRCode from 'qrcode';
import safeCompare from 'safe-compare';

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expoSignature = req.headers['expo-signature'];
  const secret = process.env.EAS_WEBHOOK_SECRET;
  const wechatWebhook = process.env.WECHAT_WEBHOOK_URL;

  if (!secret || !wechatWebhook) {
    console.error('[eas-hook] 缺少环境变量: EAS_WEBHOOK_SECRET 或 WECHAT_WEBHOOK_URL');
    return res.status(500).send('Server configuration error');
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (e) {
    console.error('[eas-hook] 读取 body 失败', e);
    return res.status(400).send('Bad request');
  }

  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(rawBody);
  const hash = `sha1=${hmac.digest('hex')}`;

  if (!safeCompare(expoSignature || '', hash)) {
    console.error('[eas-hook] 签名校验失败');
    return res.status(401).send('Invalid signature');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    console.error('[eas-hook] JSON 解析失败', e);
    return res.status(400).send('Invalid JSON');
  }

  if (payload.status !== 'finished') {
    console.log(`[eas-hook] 忽略非成功构建: status=${payload.status}`);
    return res.send('OK');
  }

  const buildUrl = payload.artifacts?.buildUrl;
  if (!buildUrl) {
    console.error('[eas-hook] 构建成功但无 buildUrl');
    return res.status(400).send('No build URL');
  }

  const { projectName, platform, metadata = {} } = payload;
  const appVersion = metadata.appVersion || '-';
  const appBuildVersion = metadata.appBuildVersion || '-';

  try {
    const qrBuffer = await QRCode.toBuffer(buildUrl, {
      type: 'png',
      width: 256,
      margin: 2,
    });

    const base64Image = qrBuffer.toString('base64');
    const md5Hash = crypto.createHash('md5').update(qrBuffer).digest('hex');

    const imagePayload = {
      msgtype: 'image',
      image: { base64: base64Image, md5: md5Hash },
    };

    const imageRes = await fetch(wechatWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imagePayload),
    });

    if (!imageRes.ok) {
      const errText = await imageRes.text();
      throw new Error(`企业微信图片发送失败: ${imageRes.status} ${errText}`);
    }

    const textContent = `【EAS 构建成功】
项目: ${projectName}
平台: ${platform}
版本: ${appVersion} (${appBuildVersion})
下载: ${buildUrl}`;

    const textRes = await fetch(wechatWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: { content: textContent },
      }),
    });

    if (!textRes.ok) {
      const errText = await textRes.text();
      throw new Error(`企业微信文本发送失败: ${textRes.status} ${errText}`);
    }

    console.log(`[eas-hook] 已推送: ${projectName} ${platform}`);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[eas-hook] 推送失败', err);
    return res.status(500).send(err.message || 'Internal error');
  }
}
