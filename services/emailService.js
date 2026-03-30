import nodemailer from 'nodemailer';

let transporter;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arbor & Co.</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f0e8; font-family: 'Georgia', serif; }
    .wrapper { max-width: 620px; margin: 40px auto; background: #ffffff; }
    .header { background: #2d4a3e; padding: 32px 40px; text-align: center; }
    .header h1 { color: #f5f0e8; font-size: 28px; letter-spacing: 0.15em; margin: 0; font-weight: 400; }
    .header p { color: #a8c5b5; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; margin: 6px 0 0; }
    .body { padding: 40px; }
    .label { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #8a7968; font-family: Arial, sans-serif; }
    .value { font-size: 16px; color: #2c2c2c; margin: 4px 0 20px; font-family: Arial, sans-serif; }
    .order-id { background: #f5f0e8; padding: 20px; text-align: center; margin: 24px 0; }
    .order-id .id { font-size: 28px; color: #2d4a3e; letter-spacing: 0.1em; font-weight: bold; }
    .items-table { width: 100%; border-collapse: collapse; margin: 24px 0; font-family: Arial, sans-serif; }
    .items-table th { background: #2d4a3e; color: #f5f0e8; padding: 10px 14px; text-align: left; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
    .items-table td { padding: 12px 14px; border-bottom: 1px solid #f0ebe3; font-size: 14px; color: #2c2c2c; }
    .total-row td { font-weight: bold; font-size: 16px; background: #f5f0e8; border-top: 2px solid #2d4a3e; }
    .cta { display: block; text-align: center; margin: 32px 0 8px; }
    .cta a { background: #2d4a3e; color: #ffffff; padding: 14px 36px; text-decoration: none; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; font-family: Arial, sans-serif; font-weight: bold; }
    .footer { background: #2c2c2c; padding: 24px 40px; text-align: center; }
    .footer p { color: #8a7968; font-size: 12px; margin: 4px 0; font-family: Arial, sans-serif; }
    .divider { border: none; border-top: 1px solid #f0ebe3; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>ARBOR & CO.</h1>
      <p>Fine Furniture · Lagos, Nigeria</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>14 Admiralty Way, Lekki Phase 1, Lagos</p>
      <p>hello@arborandco.com · +234 800 123 4567</p>
      <p style="margin-top: 12px; color: #555;">© ${new Date().getFullYear()} Arbor & Co. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

const formatPrice = (n) => `₦${Number(n).toLocaleString('en-NG')}`;

export const sendOrderConfirmationToCustomer = async (order) => {
  const itemsRows = order.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatPrice(item.price * item.quantity)}</td>
    </tr>`).join('');

  const content = `
    <p class="label">Hello,</p>
    <h2 style="font-size:24px; color:#2c2c2c; margin:0 0 8px;">Your order is confirmed! 🎉</h2>
    <p style="color:#8a7968; font-family:Arial,sans-serif; font-size:14px; line-height:1.7;">
      Thank you, <strong>${order.customer.name}</strong>. We've received your order and our team is getting it ready.
    </p>

    <div class="order-id">
      <p class="label">Your Order ID</p>
      <p class="id">${order.orderId}</p>
      <p style="font-family:Arial,sans-serif; font-size:12px; color:#8a7968; margin:4px 0 0;">Save this to track your delivery</p>
    </div>

    <table class="items-table">
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${itemsRows}
        <tr><td colspan="2" style="text-align:right; padding-top:12px; color:#8a7968; font-size:13px;">Subtotal</td><td style="text-align:right; padding-top:12px;">${formatPrice(order.subtotal)}</td></tr>
        <tr><td colspan="2" style="text-align:right; color:#8a7968; font-size:13px;">Delivery (${order.deliveryLocation})</td><td style="text-align:right;">${formatPrice(order.deliveryFee)}</td></tr>
      </tbody>
      <tfoot><tr class="total-row"><td colspan="2">Total Paid</td><td style="text-align:right">${formatPrice(order.total)}</td></tr></tfoot>
    </table>

    <hr class="divider">
    <p class="label">Delivery Address</p>
    <p class="value">${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state}</p>

    <p class="label">Estimated Delivery</p>
    <p class="value">${new Date(order.estimatedDelivery).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

    <div class="cta">
      <a href="${process.env.CLIENT_URL}/track-order?orderId=${order.orderId}">Track Your Order</a>
    </div>

    <p style="font-family:Arial,sans-serif; font-size:13px; color:#8a7968; text-align:center; margin-top:24px;">
      Questions? Reply to this email or WhatsApp us at +234 800 123 4567
    </p>`;

  await getTransporter().sendMail({
    from: `"Arbor & Co." <${process.env.EMAIL_USER}>`,
    to: order.customer.email,
    subject: `✅ Order Confirmed — ${order.orderId} | Arbor & Co.`,
    html: baseTemplate(content),
  });
};

export const sendOrderNotificationToAdmin = async (order) => {
  const itemsList = order.items.map(i => `• ${i.name} × ${i.quantity} — ${formatPrice(i.price * i.quantity)}`).join('\n');

  const content = `
    <h2 style="font-size:22px; color:#2d4a3e; margin:0 0 20px;">🛒 New Order Received</h2>

    <div class="order-id">
      <p class="label">Order ID</p>
      <p class="id">${order.orderId}</p>
      <p style="font-family:Arial,sans-serif; font-size:12px; color:#8a7968; margin:4px 0 0;">${new Date(order.createdAt).toLocaleString('en-NG')}</p>
    </div>

    <p class="label">Customer</p>
    <p class="value">${order.customer.name} · ${order.customer.email} · ${order.customer.phone}</p>

    <p class="label">Delivery Address</p>
    <p class="value">${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state}</p>

    <table class="items-table">
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${order.items.map(item => `<tr><td>${item.name}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${formatPrice(item.price * item.quantity)}</td></tr>`).join('')}
      </tbody>
      <tfoot>
        <tr><td colspan="2" style="text-align:right; color:#8a7968; font-size:13px;">Subtotal</td><td style="text-align:right;">${formatPrice(order.subtotal)}</td></tr>
        <tr><td colspan="2" style="text-align:right; color:#8a7968; font-size:13px;">Delivery</td><td style="text-align:right;">${formatPrice(order.deliveryFee)}</td></tr>
        <tr class="total-row"><td colspan="2">Total</td><td style="text-align:right">${formatPrice(order.total)}</td></tr>
      </tfoot>
    </table>

    <div class="cta">
      <a href="${process.env.CLIENT_URL}/admin/orders">Manage Order in Dashboard</a>
    </div>`;

  await getTransporter().sendMail({
    from: `"Arbor & Co. Orders" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `🛒 New Order — ${order.orderId} — ${formatPrice(order.total)}`,
    html: baseTemplate(content),
  });
};

export const sendStatusUpdateEmail = async (order) => {
  const statusMessages = {
    Processing: { emoji: '⚙️', headline: "We're preparing your order!", body: 'Our team is carefully packaging your items for dispatch.' },
    Shipped: { emoji: '🚚', headline: 'Your order is on its way!', body: `Your furniture is headed to ${order.shippingAddress.city}. Expected delivery in 2–3 days.` },
    Delivered: { emoji: '✅', headline: 'Order Delivered!', body: 'We hope you love your new furniture. Please share a photo with us!' },
    Cancelled: { emoji: '❌', headline: 'Order Cancelled', body: 'Your order has been cancelled. If you paid, a refund will be processed within 3–5 business days.' },
  };

  const msg = statusMessages[order.status];
  if (!msg) return;

  const content = `
    <h2 style="font-size:26px; color:#2c2c2c; margin:0 0 8px;">${msg.emoji} ${msg.headline}</h2>
    <p style="font-family:Arial,sans-serif; font-size:15px; color:#8a7968; line-height:1.7;">${msg.body}</p>

    <div class="order-id">
      <p class="label">Order Reference</p>
      <p class="id">${order.orderId}</p>
    </div>

    <div class="cta">
      <a href="${process.env.CLIENT_URL}/track-order?orderId=${order.orderId}">View Order Status</a>
    </div>`;

  await getTransporter().sendMail({
    from: `"Arbor & Co." <${process.env.EMAIL_USER}>`,
    to: order.customer.email,
    subject: `${msg.emoji} Order Update — ${order.orderId} | Arbor & Co.`,
    html: baseTemplate(content),
  });
};

export const sendContactEmailToAdmin = async ({ name, email, subject, message }) => {
  const content = `
    <h2 style="font-size:22px; color:#2d4a3e; margin:0 0 20px;">✉️ New Contact Message</h2>

    <p class="label">From</p>
    <p class="value">${name} &lt;${email}&gt;</p>

    <p class="label">Subject</p>
    <p class="value">${subject}</p>

    <p class="label">Message</p>
    <p class="value" style="white-space: pre-wrap; line-height: 1.6;">${message}</p>

    <div class="cta">
      <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}">Reply to ${name}</a>
    </div>`;

  await getTransporter().sendMail({
    from: `"Arbor & Co. Contact" <${process.env.EMAIL_USER}>`,
    replyTo: email,
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `✉️ Contact: ${subject} — ${name}`,
    html: baseTemplate(content),
  });
};
