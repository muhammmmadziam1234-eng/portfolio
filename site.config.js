// The only file you need to edit to personalise the site. An empty value hides what it would show.
export default {
  // Shown at the top left, in the home page heading and in page titles. Leave empty to show "Portfolio".
  name: 'Muhamad Ziam',
  // DRAFT, taken from the positioning in the redesign brief. Shown under your name on the home page. Edit to suit.
  role: 'Freelance engineer for web maps and data tools',
  // DRAFT: one sentence under your role on the home page.
  tagline: 'I build web maps, data tools and tested applications, and I show the evidence behind every claim.',
  // TODO(owner): a few sentences about you for the About page. Hidden while empty.
  bio: '',
  // TODO(owner): where you work from, for example 'Colombo, Sri Lanka'. Hidden while empty.
  location: '',
  // TODO(owner): for example 'Taking new projects'. Hidden while empty.
  availability: '',
  // TODO(owner): only if you want an email address on the public site. Hidden while empty.
  email: '',
  // TODO(owner): path to a square photo, for example 'assets/img/photo.jpg'. Hidden while empty.
  photo: '',
  // Your Upwork profile address. The "Hire me on Upwork" button appears when this is set.
  upworkUrl: 'https://www.upwork.com/freelancers/~010483298d7b3e7550',
  // Where the site is published. Used for the share pages and social preview pictures (scripts/share.mjs).
  siteUrl: 'https://muhammmmadziam1234-eng.github.io/portfolio/',
  // The GitHub account that owns the repositories; evidence links are built from it.
  githubUser: 'muhammmmadziam1234-eng',
  // The three projects shown large on the home page, by their address name.
  featured: ['atlas', 'kit', 'lamp'],
  // DRAFT: what you offer, written only from what the projects show. Edit, add or remove freely; keep figures out of here.
  services: [
    {title: 'Web maps and spatial analysis', text: 'Interactive maps that answer one clear question, with the analysis checked against an established geometry library.'},
    {title: 'Data cleaning and validation', text: 'Libraries and command-line tools that tidy messy files, say why each record was rejected and write a report you can check.'},
    {title: 'Tested web applications', text: 'Sign-in and roles, an API described in OpenAPI, and tests that run whenever the code changes.'},
    {title: 'Circuit boards and product visuals', text: 'Board layout through to the files a factory needs, and product models rendered and animated in Blender.'}
  ]
};
