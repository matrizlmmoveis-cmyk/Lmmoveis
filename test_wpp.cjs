async function test() {
  const api_url = 'https://evolution-api-d8bj-production.up.railway.app';
  const instance_name = 'lm-moveis';
  const api_key = '046ac732c84e016dcb525f29e7e947766b4aa33d047b362aea84e07b8528097d';

  const mediaEndpoint = `${api_url}/message/sendMedia/${instance_name}`;
  const mediaResponse = await fetch(mediaEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': api_key
    },
    body: JSON.stringify({
      number: '5511999999999', // dummy
      mediatype: "image",
      caption: `Produto Teste`,
      media: "https://wpryhjhfgmggvvyamyfi.supabase.co/storage/v1/object/public/produtos/14cb35c9-2708-4ba8-9bce-6712b772cae6-frente.jpeg"
    })
  });

  const text = await mediaResponse.text();
  console.log('Status:', mediaResponse.status);
  console.log('Response:', text);
}
test();
