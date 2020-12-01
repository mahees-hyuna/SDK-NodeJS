const qs = require('querystring');
const chai = require('chai');
const mocha = require('mocha');
const expect = chai.expect;

const gateway = require('../gateway.js').Gateway;

// This provides placeholder data for demonstration purposes only.
function getInitialFields(pageURL, remoteAddress) {

	let uniqid = Math.random().toString(36).substr(2, 10)

	return {
		"merchantID": "100856",
		"action": "SALE",
		"type": 1,
		// In production you'd use: uniqid. For testing purposes this needs to
		// be static to cater for signature calculation and the testing of
		// the output provided
		"transactionUnique": 'somethingUnique12345',
		"countryCode": 826,
		"currencyCode": 826,
		"amount": 1001,
		"cardNumber": "4012001037141112",
		"cardExpiryMonth": 12,
		"cardExpiryYear": 20,
		"cardCVV": "083",
		"customerName": "Test Customer",
		"customerEmail": "test@testcustomer.com",
		"customerAddress": "16 Test Street",
		"customerPostCode": "TE15 5ST",
		"orderRef": "Test purchase",
		'redirectURL': 'https://www.google.co.uk',

		// The following fields are mandatory for 3DS v2 direct integration
		// only
		"remoteAddress": remoteAddress,
		"merchantCategoryCode": 5411,
		"threeDSVersion": "2",
		"threeDSRedirectURL": pageURL + "&acs=1",
	}
}

function testCollectBrowserInfo() {

	const expected = [
		'browserInfo[deviceChannel]',
		'browserInfo[deviceIdentity]',
		'browserInfo[deviceTimeZone]',
		'browserInfo[deviceCapabilities]',
		'browserInfo[deviceScreenResolution]',
		'browserInfo[deviceAcceptContent]',
		'browserInfo[deviceAcceptEncoding]',
		'browserInfo[deviceAcceptLanguage]',
	]

	req = {};
	req.headers = {};
	req.headers['user-agent'] = 'ExampleUserAgent';
	req.headers['accept'] = 'ExampleAcceptParam';
	req.headers['accept-encoding'] = 'ExampleAcceptEncoding';
	req.headers['accept-language'] = 'ExampleAcceptLanguage';

	let testCollectBrowserData = gateway.collectBrowserInfo(req);

	expected.forEach((exp => {
		expect(testCollectBrowserData).to.include(exp);
	}));
}

function testHostedRequest() {
	const expected = `<form method="post"  action="https://test.3ds-pit.com/hosted/">
<input type="hidden" name="merchantID" value="100856" />
<input type="hidden" name="action" value="SALE" />
<input type="hidden" name="type" value="1" />
<input type="hidden" name="transactionUnique" value="somethingUnique12345" />
<input type="hidden" name="countryCode" value="826" />
<input type="hidden" name="currencyCode" value="826" />
<input type="hidden" name="amount" value="1001" />
<input type="hidden" name="cardNumber" value="4012001037141112" />
<input type="hidden" name="cardExpiryMonth" value="12" />
<input type="hidden" name="cardExpiryYear" value="20" />
<input type="hidden" name="cardCVV" value="083" />
<input type="hidden" name="customerName" value="Test Customer" />
<input type="hidden" name="customerEmail" value="test@testcustomer.com" />
<input type="hidden" name="customerAddress" value="16 Test Street" />
<input type="hidden" name="customerPostCode" value="TE15 5ST" />
<input type="hidden" name="orderRef" value="Test purchase" />
<input type="hidden" name="redirectURL" value="https://www.google.co.uk" />
<input type="hidden" name="remoteAddress" value="8.8.8.8" />
<input type="hidden" name="merchantCategoryCode" value="5411" />
<input type="hidden" name="threeDSVersion" value="2" />
<input type="hidden" name="threeDSRedirectURL" value="https://gateway.cardstream.com/hosted/&amp;acs=1" />
<input type="hidden" name="signature" value="29188d5f84245a36a9a62c43bfae32f1f5c022dc1112147ac7930947762c5c6d14e7f27b4c5406ea8e051f6b73181112f6f7f30bd52b4f1024fff3cc663178b7" />
<input  type="submit" value="Pay Now">
</form>
`;

	let req = getInitialFields("https://gateway.cardstream.com/hosted/", "8.8.8.8");
	let hostedResult = gateway.hostedRequest(req);

	expect(hostedResult).to.equal(expected);
}

function testDirectRequest() {
	let req = getInitialFields("https://gateway.cardstream.com/direct/", "8.8.8.8");

	req['deviceChannel'] = 'browser';
	req['deviceIdentity'] = 'ExampleUserAgent';
	req['deviceTimeZone'] = '0';
	req['deviceCapabilities'] = 'javascript';
	req['deviceScreenResolution'] = '1x1x1';
	req['deviceAcceptContent'] = 'text/html, application/xml;q=0.9, application/xhtml+xml, image/png, image/webp, image/jpeg, image/gif, image/x-xbitmap, */*;q=0.1';
	req['deviceAcceptEncoding'] = '';
	req['deviceAcceptLanguage'] = 'en-GB';

	const directResult = gateway.directRequest(req)
		.then(result => {
			// To demonstrate a valid signature, but ultimately get to the 3ds
			// challenge. As the 3ds challenges require user input, the
			// test can go no further
			expect(result).to.contain('responseCode=65802');
			expect(result).to.contain('responseMessage=3DS+AUTHENTICATION+REQUIRED');
			expect(result).to.contain('responseStatus=2');
		})
		.catch((error) => {
			// The errors are thrown here because the tests cannot go further
			// with no user input, this is just to catch it
			expect(error).to.not.be.null;
		});
}

function testQueryString() {
	const res = qs.stringify({
		'akey': 'aVa*lue',
		'bkey': 'bValue',
	});

	expect(res).to.equal('akey=aVa*lue&bkey=bValue');
}

testQueryString();
testCollectBrowserInfo();
testHostedRequest();
testDirectRequest();

function stringToStringDictionary(inputArray) {
	rtn = {}
	Object.entries(value).forEach(([key, value]) => {
		if (key.indexOf('[') != -1 && key.endswith(']')) {
			let [nestedKey, nestedValue] = key.substr(0, key.length - 1).split('[', 2)
			nestedArray = rtn[nestedKey] || {}
			nestedArray[nestedValue] = value
			rtn[nestedKey] = nestedArray
		}
		else {
			rtn[key] = value
		}
	});
	return rtn;
}
