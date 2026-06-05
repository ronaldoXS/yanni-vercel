const HTML_B64 = require('./html_data.js');

function getHTML() {
  const bytes = Buffer.from(HTML_B64, 'base64');
  return bytes.toString('utf-8');
}

const FIREBASE_PROJECT = "yanni-sushi";
const FIREBASE_API_KEY = "AIzaSyD-Qm_-JIMb5NSdow7RDAcd6PGZLDX0org";

async function buscarPedidoPorRef(ref, project, apiKey) {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery?key=${apiKey}`;
  const body = {structuredQuery:{from:[{collectionId:"pedidos"}],where:{fieldFilter:{field:{fieldPath:"referencia"},op:"EQUAL",value:{stringValue:ref}}},limit:1}};
  const r = await fetch(url, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d = await r.json();
  if (d[0]&&d[0].document) {
    const parts = d[0].document.name.split('/');
    return parts[parts.length-1];
  }
  return null;
}

async function atualizarPedido(id, dados, project, apiKey) {
  const fields = {};
  for (const [k,v] of Object.entries(dados)) {
    if (typeof v === 'string') fields[k] = {stringValue: v};
    else if (typeof v === 'number') fields[k] = {doubleValue: v};
    else if (typeof v === 'boolean') fields[k] = {booleanValue: v};
  }
  const mask = Object.keys(dados).map(k=>`updateMask.fieldPaths=${k}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/pedidos/${id}?${mask}&key=${apiKey}`;
  await fetch(url, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({fields})});
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathname = req.url.split('?')[0];

  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(getHTML());
  }

  if (req.method === 'POST' && pathname === '/webhook') {
    try {
      const body = req.body;
      const status = body.status || body.payment_status || '';
      const orderId = body.order_id || body.id || body.reference || '';
      const valor = (body.amount || body.paid_amount || 0) / 100;
      if (['approved','paid','APPROVED','PAID'].includes(status)) {
        const pedidoId = await buscarPedidoPorRef(orderId, FIREBASE_PROJECT, FIREBASE_API_KEY);
        if (pedidoId) {
          await atualizarPedido(pedidoId, {status:'pago',statusPagamento:'aprovado',pagoEm:new Date().toISOString(),valorPago:valor,infinitePayOrderId:orderId}, FIREBASE_PROJECT, FIREBASE_API_KEY);
          return res.status(200).json({ok:true,pedidoId});
        }
      }
      return res.status(200).json({ok:true});
    } catch(e) {
      return res.status(500).json({erro:e.message});
    }
  }

  if (req.method === 'POST' && pathname === '/suki-painel') {
    try {
      const body = req.body;
      const pergunta = body.pergunta || '';
      const groqKey = process.env.GROQ_API_KEY;
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+groqKey},
        body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:'Você é Suki, assistente do Yanni Sushi de Alegrete-PI. Responda em português, máximo 3 linhas.'},{role:'user',content:pergunta}],max_tokens:400})
      });
      const d = await r.json();
      const resposta = d.choices&&d.choices[0] ? d.choices[0].message.content : 'Suki não conseguiu conectar.';
      return res.status(200).json({resposta});
    } catch(e) {
      return res.status(500).json({erro:e.message});
    }
  }

  if (req.method === 'GET' && pathname === '/status') {
    return res.status(200).json({ok:true,ts:new Date().toISOString()});
  }

  return res.status(404).json({erro:'Rota não encontrada'});
};
