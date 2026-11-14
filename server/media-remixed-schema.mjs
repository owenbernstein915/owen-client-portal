const field = (name, label, type = 'string', extra = {}) => ({ name, label, type, ...extra });
const required = (name, label, type = 'string') => field(name, label, type, { required: true });
const object = (name, label, fields) => ({ name, label, type: 'object', required: true, fields });

export default [{
  name: 'website', label: 'Media Remixed website', type: 'file',
  path: 'content/media-remixed.json', format: 'json',
  fields: [
    object('site', 'Website details', [
      required('title', 'Browser and search title'),
      required('description', 'Search description', 'text'),
      required('email', 'Contact email'),
    ]),
    object('hero', 'Homepage and trailer', [
      required('host_name', 'Host credit'),
      required('intro_title', 'Introduction heading', 'text'),
      required('intro_text', 'Introduction', 'text'),
      required('trailer_label', 'Trailer label'),
      required('trailer_title', 'Trailer heading'),
      required('trailer_status', 'Trailer caption'),
    ]),
    object('about', 'About Jamie and the show', [
      required('eyebrow', 'Small heading'),
      required('name', 'Host name', 'text'),
      required('tagline', 'Host introduction', 'text'),
      required('biography', 'Biography', 'text'),
      required('image', 'Host portrait', 'image'),
      required('image_alt', 'Portrait description'),
      required('show_title', 'About the show heading'),
      required('show_description', 'About the show', 'text'),
    ]),
    object('episodes', 'Episodes', [
      required('title', 'Section heading'),
      required('description', 'Episodes page introduction', 'text'),
      { name: 'items', label: 'Episodes', type: 'object', list: { min: 0, max: 100 }, fields: [
        required('title', 'Episode title'),
        required('description', 'Episode description', 'text'),
        field('url', 'Listen or watch URL', 'string', { description: 'Leave blank for an episode that is coming soon.' }),
        field('image', 'Episode artwork', 'image'),
        field('image_alt', 'Artwork description'),
        required('available', 'Show this episode', 'boolean'),
      ] },
    ]),
    object('newsletter', 'Newsletter', [
      required('eyebrow', 'Small heading'),
      required('title', 'Heading', 'text'),
      required('tagline', 'Introduction'),
      required('description', 'Description', 'text'),
      required('signup_title', 'Subscribe panel heading', 'text'),
      required('button_text', 'Subscribe button text'),
    ]),
    object('listen', 'Listen and follow', [required('title', 'Page heading'), required('description', 'Introduction', 'text')]),
    object('links', 'Podcast, social and Substack links', [
      ...['youtube', 'instagram', 'linkedin', 'tiktok', 'spotify', 'apple_podcasts', 'substack'].map(name =>
        field(name + '_url', name === 'apple_podcasts' ? 'Apple Podcasts URL' : name[0].toUpperCase() + name.slice(1) + ' URL', 'string', { description: 'Leave blank to show coming soon.' })),
    ]),
  ],
}];
