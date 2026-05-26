const axios = require('axios');

async function cleanHolySheet() {
  const apiKey = 'A4NWMO7Hr9zJGlf1epJAOGzp0mzBfLMH';
  const baseUrl = 'https://holysheet.soneshjain.com/api/v1';

  try {
    const infoRes = await axios.get(`${baseUrl}/${apiKey}/info`);
    console.log('Tabs:', infoRes.data.sheets);
  } catch (err) {
    console.error('Info Error:', err.response ? err.response.data : err.message);
  }
}

cleanHolySheet();
