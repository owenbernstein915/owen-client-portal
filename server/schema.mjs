export default [
  {
    "name": "website",
    "label": "Website Content",
    "type": "file",
    "path": "src/content/site.json",
    "format": "json",
    "operations": {
      "create": false,
      "rename": false,
      "delete": false
    },
    "fields": [
      {
        "name": "announcement",
        "label": "Announcement Banner",
        "type": "object",
        "fields": [
          {
            "name": "enabled",
            "label": "Show announcement",
            "type": "boolean"
          },
          {
            "name": "text",
            "label": "Announcement text",
            "type": "string"
          }
        ]
      },
      {
        "name": "brand",
        "label": "Business Name",
        "type": "object",
        "fields": [
          {
            "name": "name",
            "label": "Main name",
            "type": "string",
            "required": true
          },
          {
            "name": "subtitle",
            "label": "Subtitle",
            "type": "string"
          },
          {
            "name": "location",
            "label": "Footer location",
            "type": "string"
          }
        ]
      },
      {
        "name": "hero",
        "label": "Homepage Introduction",
        "type": "object",
        "fields": [
          {
            "name": "eyebrow",
            "label": "Small heading",
            "type": "string"
          },
          {
            "name": "title",
            "label": "Main heading",
            "type": "string",
            "required": true
          },
          {
            "name": "description",
            "label": "Description",
            "type": "text"
          },
          {
            "name": "image",
            "label": "Main image",
            "type": "image"
          },
          {
            "name": "imageAlt",
            "label": "Image description",
            "type": "string",
            "description": "Describe the image for accessibility."
          },
          {
            "name": "buttonText",
            "label": "Button text",
            "type": "string"
          },
          {
            "name": "buttonUrl",
            "label": "Button link",
            "type": "string"
          }
        ]
      },
      {
        "name": "bakery",
        "label": "Bakery Section",
        "type": "object",
        "fields": [
          {
            "name": "eyebrow",
            "label": "Small heading",
            "type": "string"
          },
          {
            "name": "heading",
            "label": "Main heading",
            "type": "string"
          },
          {
            "name": "description",
            "label": "Description",
            "type": "text"
          },
          {
            "name": "image",
            "label": "Image",
            "type": "image"
          },
          {
            "name": "imageAlt",
            "label": "Image description",
            "type": "string"
          },
          {
            "name": "primaryButtonText",
            "label": "Menu button text",
            "type": "string"
          },
          {
            "name": "primaryButtonUrl",
            "label": "Menu button link",
            "type": "string"
          },
          {
            "name": "secondaryButtonText",
            "label": "Inquiry link text",
            "type": "string"
          },
          {
            "name": "secondaryButtonUrl",
            "label": "Inquiry link URL",
            "type": "string"
          }
        ]
      },
      {
        "name": "story",
        "label": "Our Story Section",
        "type": "object",
        "fields": [
          {
            "name": "eyebrow",
            "label": "Small heading",
            "type": "string"
          },
          {
            "name": "heading",
            "label": "Main heading",
            "type": "string"
          },
          {
            "name": "description",
            "label": "Main description",
            "type": "text"
          },
          {
            "name": "image",
            "label": "Owners image",
            "type": "image"
          },
          {
            "name": "imageAlt",
            "label": "Image description",
            "type": "string"
          },
          {
            "name": "imageCaption",
            "label": "Image caption",
            "type": "string"
          },
          {
            "name": "owners",
            "label": "Owner biographies",
            "type": "object",
            "list": {
              "collapsible": {
                "collapsed": true,
                "summary": "{name}"
              }
            },
            "fields": [
              {
                "name": "name",
                "label": "Name",
                "type": "string",
                "required": true
              },
              {
                "name": "bio",
                "label": "Biography",
                "type": "text"
              },
              {
                "name": "linkText",
                "label": "Optional link text",
                "type": "string"
              },
              {
                "name": "linkUrl",
                "label": "Optional link URL",
                "type": "string"
              }
            ]
          }
        ]
      },
      {
        "name": "reviews",
        "label": "Reviews Section",
        "type": "object",
        "fields": [
          {
            "name": "eyebrow",
            "label": "Small heading",
            "type": "string"
          },
          {
            "name": "rating",
            "label": "Google rating",
            "type": "string"
          },
          {
            "name": "ratingText",
            "label": "Rating description",
            "type": "string"
          },
          {
            "name": "reviewsUrl",
            "label": "Google reviews link",
            "type": "string"
          },
          {
            "name": "items",
            "label": "Featured reviews",
            "type": "object",
            "list": {
              "collapsible": {
                "collapsed": true,
                "summary": "{source}"
              }
            },
            "fields": [
              {
                "name": "quote",
                "label": "Review text",
                "type": "text",
                "required": true
              },
              {
                "name": "source",
                "label": "Source",
                "type": "string"
              },
              {
                "name": "visible",
                "label": "Show review",
                "type": "boolean"
              }
            ]
          }
        ]
      },
      {
        "name": "social",
        "label": "Photo Section",
        "type": "object",
        "fields": [
          {
            "name": "eyebrow",
            "label": "Small heading",
            "type": "string"
          },
          {
            "name": "heading",
            "label": "Main heading",
            "type": "string"
          },
          {
            "name": "buttonText",
            "label": "Instagram button text",
            "type": "string"
          },
          {
            "name": "images",
            "label": "Images",
            "type": "object",
            "list": {
              "collapsible": {
                "collapsed": true,
                "summary": "{alt}"
              }
            },
            "fields": [
              {
                "name": "image",
                "label": "Image",
                "type": "image",
                "required": true
              },
              {
                "name": "alt",
                "label": "Image description",
                "type": "string"
              },
              {
                "name": "visible",
                "label": "Show image",
                "type": "boolean"
              }
            ]
          }
        ]
      },
      {
        "name": "reservation",
        "label": "Reservation Section",
        "type": "object",
        "fields": [
          {
            "name": "eyebrow",
            "label": "Small heading",
            "type": "string"
          },
          {
            "name": "heading",
            "label": "Main heading",
            "type": "string"
          },
          {
            "name": "description",
            "label": "Description",
            "type": "text"
          },
          {
            "name": "liveLinkText",
            "label": "Toast link text",
            "type": "string"
          }
        ]
      },
      {
        "name": "visit",
        "label": "Location and Hours",
        "type": "object",
        "fields": [
          {
            "name": "eyebrow",
            "label": "Small heading",
            "type": "string"
          },
          {
            "name": "addressLine1",
            "label": "Street address",
            "type": "string"
          },
          {
            "name": "addressLine2",
            "label": "City and state",
            "type": "string"
          },
          {
            "name": "phoneDisplay",
            "label": "Displayed phone number",
            "type": "string"
          },
          {
            "name": "phoneUrl",
            "label": "Phone link",
            "type": "string",
            "description": "Use the format tel:+19737072082."
          },
          {
            "name": "mapUrl",
            "label": "Directions link",
            "type": "string"
          },
          {
            "name": "hours",
            "label": "Business hours",
            "type": "object",
            "list": {
              "min": 1,
              "max": 7,
              "collapsible": {
                "collapsed": true,
                "summary": "{day}: {time}"
              }
            },
            "fields": [
              {
                "name": "day",
                "label": "Day",
                "type": "string",
                "required": true
              },
              {
                "name": "time",
                "label": "Hours",
                "type": "string",
                "required": true
              }
            ]
          },
          {
            "name": "hoursNote",
            "label": "Hours note",
            "type": "text"
          }
        ]
      },
      {
        "name": "contact",
        "label": "Contact Section",
        "type": "object",
        "fields": [
          {
            "name": "eyebrow",
            "label": "Small heading",
            "type": "string"
          },
          {
            "name": "heading",
            "label": "Main heading",
            "type": "string"
          },
          {
            "name": "description",
            "label": "Description",
            "type": "text"
          },
          {
            "name": "email",
            "label": "Email address",
            "type": "string"
          }
        ]
      },
      {
        "name": "links",
        "label": "External Links",
        "type": "object",
        "fields": [
          {
            "name": "reservations",
            "label": "Toast reservation link",
            "type": "string"
          },
          {
            "name": "orderOnline",
            "label": "Toast ordering link",
            "type": "string"
          },
          {
            "name": "instagram",
            "label": "Instagram link",
            "type": "string"
          },
          {
            "name": "facebook",
            "label": "Facebook link",
            "type": "string"
          }
        ]
      }
    ]
  },
  {
    "name": "menus",
    "label": "Full Menu",
    "type": "file",
    "path": "src/content/menu.json",
    "format": "json",
    "list": true,
    "operations": {
      "create": false,
      "rename": false,
      "delete": false
    },
    "fields": [
      {
        "name": "id",
        "label": "Internal ID",
        "type": "string",
        "required": true,
        "readonly": true
      },
      {
        "name": "label",
        "label": "Menu name",
        "type": "string",
        "required": true
      },
      {
        "name": "kicker",
        "label": "Schedule or description",
        "type": "string"
      },
      {
        "name": "note",
        "label": "Menu subtitle",
        "type": "string"
      },
      {
        "name": "sections",
        "label": "Categories",
        "type": "object",
        "list": {
          "collapsible": {
            "collapsed": true,
            "summary": "{title}"
          }
        },
        "fields": [
          {
            "name": "title",
            "label": "Category name",
            "type": "string",
            "required": true
          },
          {
            "name": "items",
            "label": "Menu items",
            "type": "object",
            "list": {
              "collapsible": {
                "collapsed": true,
                "summary": "{name} — {price}"
              }
            },
            "fields": [
              {
                "name": "name",
                "label": "Item name",
                "type": "string",
                "required": true
              },
              {
                "name": "detail",
                "label": "Description",
                "type": "text"
              },
              {
                "name": "price",
                "label": "Price",
                "type": "string"
              },
              {
                "name": "available",
                "label": "Currently available",
                "type": "boolean"
              }
            ]
          }
        ]
      }
    ]
  }
];
