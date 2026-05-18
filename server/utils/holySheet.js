const axios = require('axios');

const BASE_URL = 'https://holysheet.soneshjain.com/api/v1';

/**
 * HolySheet Utility for interacting with Google Sheets
 */
class HolySheet {
  constructor() {
    this.apiKey = process.env.HOLYSHEET_API_KEY;
  }

  async getRows(sheetName) {
    if (!this.apiKey) throw new Error('HOLYSHEET_API_KEY missing');
    const response = await axios.get(`${BASE_URL}/${this.apiKey}/rows`, {
      params: { sheet: sheetName }
    });
    return response.data.data;
  }

  async getRowsCustomKey(sheetName, customKey) {
    const key = customKey || this.apiKey;
    if (!key) throw new Error('HolySheet API Key missing');
    const response = await axios.get(`${BASE_URL}/${key}/rows`, {
      params: { sheet: sheetName }
    });
    return response.data.data || [];
  }

  async appendRows(sheetName, rows) {
    if (!this.apiKey) throw new Error('HOLYSHEET_API_KEY missing');
    const response = await axios.post(`${BASE_URL}/${this.apiKey}/rows`, {
      rows
    }, {
      params: { sheet: sheetName }
    });
    return response.data;
  }

  async updateRow(rowIndex, values, sheetName) {
    if (!this.apiKey) throw new Error('HOLYSHEET_API_KEY missing');
    const response = await axios.patch(`${BASE_URL}/${this.apiKey}/rows`, {
      rowIndex,
      values,
      sheet: sheetName
    });
    return response.data;
  }
}

module.exports = new HolySheet();
