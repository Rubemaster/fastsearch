(function (blocks, element, blockEditor, components, i18n) {
  var el = element.createElement;
  var Fragment = element.Fragment;
  var InspectorControls = blockEditor.InspectorControls;
  var useBlockProps = blockEditor.useBlockProps;
  var PanelBody = components.PanelBody;
  var TextControl = components.TextControl;
  var __ = i18n.__;

  blocks.registerBlockType('fastsearch/search', {
    edit: function (props) {
      var attrs = props.attributes;
      var set = props.setAttributes;
      var blockProps = useBlockProps();
      var ph = attrs.placeholder || 'Type a postcode...';

      return el(Fragment, null,
        el(InspectorControls, null,
          el(PanelBody, { title: __('Settings', 'fastsearch'), initialOpen: true },
            el(TextControl, {
              label: __('Placeholder text', 'fastsearch'),
              value: ph,
              onChange: function (v) { set({ placeholder: v }); }
            })
          )
        ),
        el('div', blockProps,
          el('input', {
            type: 'text',
            placeholder: ph,
            disabled: true,
            style: {
              width: '300px',
              maxWidth: '100%',
              fontSize: '16px',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              background: '#fff',
              color: '#555',
              cursor: 'pointer'
            }
          }),
          el('div', { style: { marginTop: '4px', fontSize: '13px', color: '#888' } },
            'Type a postcode to find energy plans from api.ratemapaustralia.com.au'
          )
        )
      );
    },
    save: function () { return null; }
  });
})(window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n);
