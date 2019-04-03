const COMMON_HEADERS = { 'X-Adzerk-ApiKey': null };
const BASE_URL = 'https://62y4dsxai6.execute-api.us-east-1.amazonaws.com/prod';

CACHE = {
  zones: {},
  creatives: {},
  sites: {}
};

// https://dev.adzerk.com/v1.0/reference/zone#get-zon
function getZone(zoneId) {
  return new Promise((resolve, reject) => {
    if (CACHE.zones[zoneId]) {
      resolve(CACHE.zones[zoneId]);
    } else {
      const url = `${BASE_URL}/management/v1/zone/${zoneId}`;

      fetch(url, { headers: COMMON_HEADERS })
        .then(response => response.json())
        .then(data => { CACHE.zones[zoneId] = data; resolve(data); })
        .catch(e => reject(e));
    }
  });
}

// https://dev.adzerk.com/v1.0/reference/creative#get-creative
function getCreative(creativeId) {
  return new Promise((resolve, reject) => {
    if (CACHE.creatives[creativeId]) {
      resolve(CACHE.creatives[creativeId]);
    } else {
      const url = `${BASE_URL}/management/v1/creative/${creativeId}`;

      fetch(url, { headers: COMMON_HEADERS })
        .then(response => response.json())
        .then(data => { CACHE.creatives[creativeId] = data; resolve(data); })
        .catch(e => reject(e));
    }
  });
}

// https://dev.adzerk.com/v1.0/reference/site#get-site
function getSite(sideId) {
  return new Promise((resolve, reject) => {
    if (CACHE.sites[sideId]) {
      resolve(CACHE.sites[sideId]);
    } else {
      const url = `${BASE_URL}/management/v1/site/${sideId}`;

      fetch(url, { headers: COMMON_HEADERS })
        .then(response => response.json())
        .then(data => { CACHE.sites[sideId] = data; resolve(data); })
        .catch(e => reject(e));
    }
  });
}

// https://dev.adzerk.com/v1.0/reference/advertiser#get-advertisers
function listAdvertisers() {
  return new Promise((resolve, reject) => {
    fetch(`${BASE_URL}/management/v1/advertiser`, { headers: COMMON_HEADERS })
      .then(response => response.json())
      .then(data => resolve(data.items.sort((a, b) => a.Title.localeCompare(b.Title))))
      .catch(e => reject(e));
  });
}

// Get the list of all campaigns for a given advertiser from the Adzerk
// management API.
// https://dev.adzerk.com/v1.0/reference/campaign#list-campaigns
function listAdvertiserCampaigns(advertiserId) {
  return new Promise((resolve, reject) => {
    fetch(`${BASE_URL}/management/v1/campaign?AdvertiserId=${advertiserId}`, { headers: COMMON_HEADERS })
      .then(response => response.json())
      .then(data => resolve(data.items.sort((a, b) => a.Name.localeCompare(b.Name))))
      .catch(e => reject(e));
  });
}

// https://dev.adzerk.com/v1.0/reference/queued-reports#create-queued-report
function createQueuedReport() {
  return new Promise((resolve, reject) => {
    const headers = {
      'X-Adzerk-ApiKey': COMMON_HEADERS['X-Adzerk-ApiKey'],
      'Content-Type': 'application/json'
    }

    // console.log(requestData());

    fetch(`${BASE_URL}/reporting/v1/queue`, { method: 'POST', headers, body: JSON.stringify(requestData()) })
      .then(response => response.json())
      .then(data => resolve(data))
      .catch(e => reject(e));
  });
}

function requestData() {
  const startTimeEl = document.getElementById('start-time');
  const endTimeEl = document.getElementById('end-time');
  const campaignsEl = document.getElementById('campaigns');
  const dateGroupEl = document.getElementById('date-group');
  const parameterGroupEl = document.getElementById('parameter-group');

  return {
    GroupBy: [dateGroupEl.value].concat(Array.from(parameterGroupEl.selectedOptions).map(o => o.value )),
    StartDateISO: `${startTimeEl.value}T00:00:00`,
    EndDateISO: `${endTimeEl.value}T00:00:00`,
    Parameters: Array.from(campaignsEl.selectedOptions).map(option => {
      return { campaignId: option.value.match(/^([0-9]+):/)[1] };
    })
  }
}

// https://dev.adzerk.com/v1.0/reference/queued-reports#poll-for-queued-report-result
function _getReport(reportId) {
  return new Promise((resolve, reject) => {
      fetch(`https://62y4dsxai6.execute-api.us-east-1.amazonaws.com/prod/reporting/v1/queue/${reportId}`, { headers: COMMON_HEADERS })
        .then(response => response.json())
        .then(data => resolve(data))
        .catch(e => reject(e));
  });
}

async function getReport(reportId) {
  return new Promise((resolve, reject) => {
    (async function waitForReport() {
      const report = await _getReport(reportId);

      if (report.Status === 3) {
        console.log('Report error');
        reject();
      } else if (report.Status === 2) {
        console.log('Report ready; returning report');
        resolve(report.Result);
      } else {
        console.log('Report not ready; waiting to try again.');
        setTimeout(waitForReport, 5000);
      }
    })();
  });
}

async function loadReport(report) {
  console.log(report)
  document.getElementById('report-placeholder').style.display = 'none';
  document.getElementById('report-result').style.display = 'table';
  document.getElementById('report-download').style.display = 'block';
  const body = document.getElementById('report-result-body');
  const footer = document.getElementById('report-result-footer');
  body.innerHTML = footer.innerHTML = '';

  for (const record of report.Records) {
    for (const details of record.Details) {
      const advertiserName = details.Grouping.BrandId ? document.getElementById('advertiser-list').advertisers.find(a => details.Grouping.BrandId === a.Id).Title : '';
      const campaignName = details.Grouping.CampaignId ? document.getElementById('campaigns').campaigns.find(c => details.Grouping.CampaignId === c.Id).Name : '';
      const zoneName = details.Grouping.ZoneId ? (await getZone(details.Grouping.ZoneId)).Name : '';
      const creativeName = details.Grouping.CreativeId ? (await getCreative(details.Grouping.CreativeId)).Title : '';
      const siteName = details.Grouping.SiteId ? (await getSite(details.Grouping.SiteId)).Title : '';

      const tr = body.appendChild(document.createElement('tr'));
      tr.appendChild(document.createElement('td')).innerHTML = details.FirstDate;
      tr.appendChild(document.createElement('td')).innerHTML = details.LastDate;
      tr.appendChild(document.createElement('td')).innerHTML = advertiserName;
      tr.appendChild(document.createElement('td')).innerHTML = campaignName;
      tr.appendChild(document.createElement('td')).innerHTML = creativeName;
      tr.appendChild(document.createElement('td')).innerHTML = siteName;
      tr.appendChild(document.createElement('td')).innerHTML = zoneName;
      tr.appendChild(document.createElement('td')).innerHTML = details.Grouping.CountryCode ? details.Grouping.CountryCode : '';
      tr.appendChild(document.createElement('td')).innerHTML = details.Grouping.MetroCode ? details.Grouping.MetroCode : '';
      tr.appendChild(document.createElement('td')).innerHTML = details.Impressions;
      // tr.appendChild(document.createElement('td')).innerHTML = (campaign ? campaign.Name : '');
      // tr.appendChild(document.createElement('td')).innerHTML = (zone ? zone.Name : '');
      // tr.appendChild(document.createElement('td')).innerHTML = details.Impressions;
    }

    // const tr = body.appendChild(document.createElement('tr'));
    // tr.appendChild(document.createElement('td')).innerHTML = record.Date;
    // tr.appendChild(document.createElement('td'));
    // tr.appendChild(document.createElement('td'));
    // tr.appendChild(document.createElement('td')).innerHTML = record.Impressions;
  }

  const tr = footer.appendChild(document.createElement('tr'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td'));
  tr.appendChild(document.createElement('td')).innerHTML = report.TotalImpressions;
}

function filterCampaigns(e) {
  if (e && e.key === 'ArrowDown') { e.preventDefault(); document.getElementById('campaigns').focus(); return; }

  const campaignsEl = document.getElementById('campaigns');
  campaignsEl.innerHTML = '';

  document.getElementById('campaigns-filter').value.split(' ').reduce((result, filter) => {
    const re = new RegExp(filter, 'i');
    return (result||[]).filter(c => c.Name.match(re));
  }, campaignsEl.campaigns).forEach(campaign => {
    const optionEl = document.createElement('option');
    optionEl.innerHTML = `${campaign.Id}: ${campaign.Name}`;
    campaignsEl.appendChild(optionEl);
  });
}

function guessDateRange() {
  const selectedCampaigns = Array.from(document.getElementById('campaigns').selectedOptions).map(v=>v.value);

  if (selectedCampaigns.length) {
    const campaign = selectedCampaigns[0];

    const match = campaign.match(/_(20\d{2})_(\d{2})(\d{2})-(\d{2})(\d{2})_/);
    if (match) {
      document.getElementById('start-time').value = `${match[1]}-${match[2]}-${match[3]}`;
      document.getElementById('end-time').value = `${match[1]}-${match[4]}-${match[5]}`;
    }
  }
}

async function selectAdvertiser() {
  try {
    const advertiserId = document.getElementById('advertiser').value.match(/^([0-9]+):/)[1];

    const campaignsEl = document.getElementById('campaigns');
    campaignsEl.innerHTML = '';
    campaignsEl.campaigns = await listAdvertiserCampaigns(advertiserId);
    for (const campaign of campaignsEl.campaigns) {
      const optionEl = document.createElement('option');
      optionEl.innerHTML = `${campaign.Id}: ${campaign.Name}`;
      campaignsEl.appendChild(optionEl);
    }

    // document.getElementById('campaigns-filter').value = '';
    filterCampaigns();
    document.getElementById('campaigns-filter').focus();
  } catch (e) {}
}

async function generateReport(e) {
  e.preventDefault();

  if (requestData().Parameters.length) {
    const createReportEl = document.getElementById('generate-report');
    const label = createReportEl.value;

    createReportEl.disabled = true;
    createReportEl.value = 'Working…';
    createReportEl.classList.add('working');

    loadReport(await getReport((await createQueuedReport()).Id));

    createReportEl.disabled = false;
    createReportEl.value = label;
    createReportEl.classList.remove('working');
  }
}

function downloadReport() {
  const csv = Array.from(document.querySelectorAll('#report-result tr')).map(row => {
    return Array.from(row.querySelectorAll('th,td')).map(c => `"${c.innerHTML.replace(/"/g, '""')}"`).join(',')
  }).join('\n')

  if (csv.length > 100) {
    anchor = document.createElement('a');
    anchor.setAttribute('href', encodeURI(`data:text/csv;charset=utf-8,${csv}`));
    anchor.setAttribute('download', `${document.getElementById('advertiser').value} - ${+(new Date())}.csv`);
    anchor.click();
  }
}

function hotkeys(e) {
  if (e.metaKey && e.key === 'k') {
    e.preventDefault(); document.getElementById('advertiser').focus();
  } else if (e.metaKey && e.key === 'g') {
    e.preventDefault(); document.getElementById('generate-report').click();
  } else if (e.metaKey && e.key === 'f') {
    e.preventDefault(); document.getElementById('campaigns-filter').focus();
  } else if (e.metaKey && e.key === 'd') {
    e.preventDefault(); downloadReport();
  }
}

(async function () {
  document.addEventListener('DOMContentLoaded', async (_) => {
    COMMON_HEADERS['X-Adzerk-ApiKey'] = window.location.search.match(/k=([a-zA-Z0-9]+)/)[1];
    if (COMMON_HEADERS['X-Adzerk-ApiKey']) { document.getElementById('key-error').style.display = 'none'; }

    document.onkeydown = hotkeys;
    document.getElementById('advertiser').addEventListener('change', selectAdvertiser);
    document.getElementById('campaigns-filter').addEventListener('keyup', filterCampaigns);
    document.getElementById('campaigns').addEventListener('input', guessDateRange);
    document.getElementById('generate-report').addEventListener('click', generateReport);
    document.getElementById('report-download').addEventListener('click', downloadReport);

    // Get the list of advertisers and load it into the data list
    const advertiserListEl = document.getElementById('advertiser-list');
    advertiserListEl.advertisers = await listAdvertisers();
    for (const advertiser of advertiserListEl.advertisers) {
      const optionEl = document.createElement('option');
      optionEl.innerHTML = `${advertiser.Id}: ${advertiser.Title}`;
      advertiserListEl.appendChild(optionEl);
    }
  });
})();