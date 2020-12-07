const http = require('http'); // Import Node.js core module
const qs = require('querystring');

const axios = require('axios');
const crypto = require('crypto');
const httpBuildQuery = require('http-build-query');
const url = require('url');
const htmlUtils = require('./htmlUtils.js');

const gateway = require('./gateway.js').Gateway;
const assert = require('assert');
// const merchantSecret = 'pass';

var server = http.createServer(function (req, res) {
	//create web server
	const getParams = url.parse(req.url, true).query;

	if (req.method != 'POST') {
		// Every other request after this is a POST.
		body = htmlUtils.collectBrowserInfo(req);
		sendResponse(body, res);
	} else {
		var body = '';

		req.on('data', function (data) {
			body += data;

			// Too much POST data, kill the connection!
			// 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
			if (body.length > 1e6) request.connection.destroy();
		});

		req.on('end', async function () {
			var post = qs.parse(body);

			if (getParams['acs']) {
				fields = {};
				for ([k, v] of Object.entries(post)) {
					fields['threeDSResponse[' + k + ']'] = v;
				}

				body = silentPost(htmlUtils.getPageUrl(req), fields, '_parent');

				sendResponse(body, res);
			} else if (anyKeyStartsWith(post, 'threeDSResponse[')) {
				let reqFields = {
					action: 'SALE',
					threeDSRef: global.threeDSRef,
				};

				for ([k, v] of Object.entries(post)) {
					if (k.startsWith('threeDSResponse[')) {
						reqFields[k] = v;
					}
				}

				gateway.directRequest(reqFields).then((response) => {
					body = processResponseFields(response, gateway);
					sendResponse(body, res);
				});
			} else {
				const transactionId = 123456786543;
				// Browser info present, but no threeDSResponse, this means it's
				// the initial request to the gateway (not 3DS) server.
				let fields = getInitialFields(
					`https://px9564gtzf.execute-api.us-east-1.amazonaws.com/Prod/api/acs/acs-response?acs=1&transactionId=${transactionId}`,
					'88.77.66.55'
				);

				const { data: getACSData } = await axios.get(
					`https://px9564gtzf.execute-api.us-east-1.amazonaws.com/Prod/api/acs/get-acs-response?transactionId=${transactionId}`,
					{
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*',
						},
					}
				);
				console.log(getACSData);
				//let fields = getInitialFields("https://node.test/any?sid=101", "88.77.66.55");

				for ([k, v] of Object.entries(post)) {
					if (k.startsWith('browserInfo[')) {
						fields[k.substr(12, k.length - 13)] = v;
					}
				}

				gateway.directRequest(fields).then((responseFields) => {
					body = processResponseFields(responseFields, gateway);
					sendResponse(body, res);
				});
			}
		});
	}
});

function anyKeyStartsWith(haystack, needle) {
	for ([k, v] of Object.entries(haystack)) {
		if (k.startsWith(needle)) {
			return true;
		}
	}

	return false;
}

function processResponseFields(responseFields, gateway) {
	switch (responseFields['responseCode']) {
		case '65802':
			global.threeDSRef = responseFields['threeDSRef'];
			return htmlUtils.showFrameForThreeDS(responseFields);
		case '0':
			return '<p>Thank you for your payment.</p>';
		default:
			return '<p>Failed to take payment: ' + responseFields['responseMessage'] + '</p>'; //HTMLEntities.new.encode TODO
	}
}

function sendResponse(body, res) {
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.write(htmlUtils.getWrapHTML(body));
	res.end();
}

server.listen(8012);

// This provides placeholder data for demonstration purposes only.
function getInitialFields(pageURL, remoteAddress) {
	let uniqid = Math.random().toString(36).substr(2, 10);

	return {
		merchantID: '100856',
		action: 'SALE',
		type: 1,
		transactionUnique: uniqid,
		countryCode: 826,
		currencyCode: 826,
		amount: 1001,
		cardNumber: '4012001037141112',
		cardExpiryMonth: 12,
		cardExpiryYear: 20,
		cardCVV: '083',
		customerName: 'Test Customer',
		customerEmail: 'test@testcustomer.com',
		customerAddress: '16 Test Street',
		customerPostCode: 'TE15 5ST',
		orderRef: 'Test purchase',

		// The following fields are mandatory for 3DSv2 direct integration only
		remoteAddress: remoteAddress,

		merchantCategoryCode: 5411,
		threeDSVersion: '2',
		threeDSRedirectURL: pageURL + '&acs=1',
	};
}

silentPost = function (url, fields, target = '_self') {
	fieldsStr = '';
	for ([k, v] of Object.entries(fields)) {
		fieldsStr += `<input type="hidden" name="${k}" value="${v}" /> \n`;
	}

	return `
		<form id="silentPost" action="${url}" method="post" target="${target}">
		${fieldsStr}
		<noscript><input type="submit" value="Continue"></noscript>
		</form>
		<script>
		window.setTimeout('document.forms.silentPost.submit()', 0);
		</script>
	`;
};
