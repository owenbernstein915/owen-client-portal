const field = (name, label, type = 'string', extra = {}) => ({ name, label, type, ...extra });
const text = (name, label, extra = {}) => field(name, label, 'text', extra);
const image = (name = 'image', label = 'Image') => field(name, label, 'image', { required: true });
const object = (name, label, fields, extra = {}) => field(name, label, 'object', { required: true, fields, ...extra });
const list = (name, label, type, fields, extra = {}) => field(name, label, type, {
  list: { min: 1, collapsible: { collapsed: true, summary: `{${fields?.[0]?.name || 'index'}}` }, ...extra },
  ...(fields ? { fields } : {}),
});
const imageWithAlt = [
  image(),
  field('alt', 'Image description', 'string', { required: true, description: 'Describe the image for visitors using screen readers.' }),
];

export default [{
  name: 'website',
  label: 'Little Daisy Website',
  type: 'file',
  path: 'content/site.json',
  format: 'json',
  operations: { create: false, rename: false, delete: false },
  fields: [
    object('site', 'Business details and links', [
      field('name', 'Short brand name', 'string', { required: true }),
      field('business_name', 'Full business name', 'string', { required: true }),
      field('brand_subtitle', 'Header subtitle', 'string', { required: true }),
      image('logo', 'Logo'),
      field('logo_alt', 'Logo description', 'string', { required: true }),
      field('seo_title', 'Browser and search title', 'string', { required: true }),
      text('seo_description', 'Search description', { required: true }),
      field('order_url', 'BentoBox ordering URL', 'string', { required: true, description: 'Every order button on the site uses this URL.' }),
      field('instagram_url', 'Instagram URL', 'string', { required: true }),
      field('facebook_url', 'Facebook URL', 'string', { required: true }),
      field('google_maps_url', 'Google Maps URL', 'string', { required: true }),
      field('phone_display', 'Phone number shown on site', 'string', { required: true }),
      field('phone_link', 'Click-to-call link', 'string', { required: true, description: 'Keep the tel: prefix, for example tel:9737072157.' }),
      field('hours_chip', 'Hours in navigation', 'string', { required: true }),
    ]),
    object('hero', 'Landing section', [
      field('eyebrow', 'Address line', 'string', { required: true }),
      field('title', 'Main heading', 'string', { required: true }),
      field('title_emphasis', 'Emphasized heading word', 'string', { required: true }),
      text('description', 'Introduction', { required: true }),
      field('primary_button', 'Order button text', 'string', { required: true }),
      field('secondary_button', 'Counter button text', 'string', { required: true }),
      list('badges', 'Highlight badges', 'string', null, { max: 4 }),
      list('images', 'Landing images', 'object', imageWithAlt, { max: 3 }),
    ]),
    list('marquee', 'Moving announcement strip', 'string', null, { max: 12 }),
    object('counter', 'The Counter section', [
      field('eyebrow', 'Small heading', 'string', { required: true }),
      field('title', 'Heading', 'string', { required: true }),
      text('description', 'Introduction', { required: true }),
      list('items', 'Counter items', 'object', [
        field('name', 'Item name', 'string', { required: true }),
        text('note', 'Description or availability', { required: true }),
        field('link_label', 'Optional link text'),
        field('link_url', 'Optional link destination'),
        field('price', 'Price', 'string', { required: true }),
        ...imageWithAlt,
      ]),
    ]),
    object('kitchen', 'Kitchen and allergy section', [
      field('eyebrow', 'Small heading', 'string', { required: true }),
      field('title', 'Heading', 'string', { required: true }),
      text('description', 'Allergy statement', { required: true }),
      field('call_button', 'Call button text', 'string', { required: true }),
      field('owner_button', 'Owner button text', 'string', { required: true }),
      list('facts', 'Kitchen facts', 'object', [
        field('title', 'Fact title', 'string', { required: true }),
        text('description', 'Fact description', { required: true }),
      ], { max: 5 }),
    ]),
    object('cakes', 'Custom Cakes section', [
      field('eyebrow', 'Small heading', 'string', { required: true }),
      field('title', 'Heading', 'string', { required: true }),
      text('description', 'Introduction', { required: true }),
      list('items', 'Cakes', 'object', [
        field('name', 'Cake name', 'string', { required: true }),
        text('description', 'Description', { required: true }),
        field('size', 'Size or servings', 'string', { required: true }),
        field('price', 'Price', 'string', { required: true }),
        ...imageWithAlt,
      ]),
      text('order_note', 'Ordering note', { required: true }),
      field('order_button', 'Ordering button text', 'string', { required: true }),
    ]),
    object('reviews', 'Reviews section', [
      field('eyebrow', 'Small heading', 'string', { required: true }),
      field('title', 'Heading', 'string', { required: true }),
      text('description', 'Introduction', { required: true }),
      field('link_label', 'Google Reviews link text', 'string', { required: true }),
      list('items', 'Featured reviews', 'object', [
        text('quote', 'Review quote', { required: true }),
        field('name', 'Reviewer name', 'string', { required: true }),
        field('initial', 'Avatar initial', 'string', { required: true }),
      ], { max: 6 }),
    ]),
    object('gallery', 'Gallery section', [
      field('eyebrow', 'Small heading', 'string', { required: true }),
      field('title', 'Heading', 'string', { required: true }),
      text('description', 'Introduction', { required: true }),
      list('images', 'Gallery images', 'object', [
        ...imageWithAlt,
        field('layout', 'Desktop layout', 'select', { required: true, options: { values: [
          { name: 'standard', label: 'Standard' },
          { name: 'wide', label: 'Wide' },
          { name: 'tall', label: 'Tall' },
        ] } }),
      ]),
    ]),
    object('owner', 'Meet the Owner section', [
      field('eyebrow', 'Small heading', 'string', { required: true }),
      field('name', 'Owner name', 'string', { required: true }),
      image('image', 'Owner image'),
      field('image_alt', 'Image description', 'string', { required: true }),
      list('paragraphs', 'Biography paragraphs', 'text', null, { max: 4 }),
      field('signature', 'Signature', 'string', { required: true }),
      field('role', 'Role', 'string', { required: true }),
    ]),
    object('visit', 'Visit section', [
      field('eyebrow', 'Small heading', 'string', { required: true }),
      field('title', 'Heading', 'string', { required: true }),
      field('address_line_1', 'Street address', 'string', { required: true }),
      field('address_line_2', 'City, state, and ZIP', 'string', { required: true }),
      list('hours', 'Store hours', 'object', [
        field('days', 'Day or range', 'string', { required: true }),
        field('time', 'Hours', 'string', { required: true }),
      ], { max: 7 }),
      field('directions_button', 'Directions button text', 'string', { required: true }),
    ]),
    object('social', 'Instagram section', [
      field('eyebrow', 'Small heading', 'string', { required: true }),
      field('handle', 'Instagram handle', 'string', { required: true }),
      field('button', 'Follow button text', 'string', { required: true }),
      list('images', 'Instagram images', 'object', imageWithAlt, { max: 6 }),
    ]),
    object('footer', 'Footer', [
      text('tagline', 'Description', { required: true }),
      field('bottom_line', 'Address line', 'string', { required: true }),
      field('credit', 'Right-side footer text', 'string', { required: true }),
    ]),
  ],
}];
