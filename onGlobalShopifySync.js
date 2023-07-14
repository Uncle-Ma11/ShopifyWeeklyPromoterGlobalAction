/**
 * Effect code for global action globalShopifySync
 * @param { import("gadget-server").GlobalShopifySyncGlobalActionContext } context - Everything for running this effect, like the api client, current record, params, etc
 */
const sgMail = require('@sendgrid/mail');
const { Configuration, OpenAIApi } = require("openai");

module.exports = async ({ api, scope, logger, params }) => {
  // access models in your Gadget application with the api object
  // const otherRecords = await api.blogPost.findMany({first: 10});

  // make API calls to other systems with libraries from npm
  // make sure to first add axios as a dependency in your package.json
  // const axios = require("axios");
  // await axios.post("https://some-other-api.com/v1/api", { body: record.toJSON() });

  // use passed in params (see definition sample below)
  // const foobar = params.foo + params.bar;

  // return values from your global action
  // scope.result = { foo: "bar" };
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const openai = new OpenAIApi(configuration);

  async function sendEmail(to, subject, text, html) {
    const msg = {
      to: to,
      from: 'lzqqqxb@gmail.com',
      subject: subject,
      text: text,
      html: html,
    };

    try {
      await sgMail.send(msg);
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async function createProductEntry(title, description, customerFirstName, customerLastName, productLink, productImageSource) {
    const promoGPT = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: `This is a Shopify product with title "${title}" and description "${description}". 
      Generate an attractive weekly promotion message of this product
      to a customer with first name "${customerFirstName}" and last name "${customerLastName}" within a word limit of 200.`,
      temperature: 0,
      max_tokens: 250
    });
    const promoText = promoGPT.data.choices[0].text;
    return `<tr>
    <td style="padding:0 0 36px 0;color:#153643;">
      <h1 style="font-size:24px;margin:0 0 20px 0;font-family:Arial,sans-serif;">${title}</h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:24px;font-family:Arial,sans-serif;">${promoText}</p>
      <a href="${productLink}"><img src="${productImageSource}" alt="Product Image" style="height: 400px; width: 400px;"></a>
    </td>
    </tr>`;
  }

  const customers = await api.shopifyCustomer.findMany({
    filter: {
      emailMarketingConsent: {
        matches: { state: "subscribed" },
      },
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  const promotingProducts = await api.shopifyProduct.findMany({
    filter: {
      tags: {
        matches: ["promoting"],
      },
    },
    select: {
      id: true,
      body: true,
      title: true,
      handle: true,
      images: {
        edges: {
          node: {
            source: true,
          },
        },
      },
      shop: {
        domain: true,
      },
    },
  });

  for (const customer of customers) {
    let emailContent = `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title></title>
  <style>
    table, td, div, h1, p {font-family: Arial, sans-serif;}
  </style>
</head>
<body style="margin:0;padding:0;">
  <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;background:#ffffff;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" style="width:602px;border-collapse:collapse;border:1px solid #cccccc;border-spacing:0;text-align:left;">
          <tr>
            <td align="center" style="padding:40px 0 30px 0;background:#70bbd9;">
              <h1 style="font-family:courier; background-color: white;">Your Weekly Choice!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 30px 42px 30px;">
              <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">`;
    for (const product of promotingProducts) {
      const productLink = `https://${product.shop.domain}/products/${product.handle}`;
      const productEntry = await createProductEntry(product.title, product.body, customer.firstName, customer.lastName, productLink, product.images.edges[0].node.source);
      emailContent = emailContent.concat(productEntry);
    }
    emailContent = emailContent.concat(`</table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;background:#ee4c50;">
              <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;font-size:9px;font-family:Arial,sans-serif;">
                <tr>
                  <h2 style="color:white;">Your Shop</h2>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`);
    sendEmail(customer.email, "Weekly Promo", "Product Recommendation of This Week", emailContent);
  }
};