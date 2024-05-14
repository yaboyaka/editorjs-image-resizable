import { IconPicture } from '@codexteam/icons';
import { make } from './utils/dom';

/**
 * Class for working with UI:
 *  - rendering base structure
 *  - show/hide preview
 *  - apply tune view
 */
export default class Ui {
  /**
   * @param {object} ui - image tool Ui module
   * @param {object} ui.api - Editor.js API
   * @param {ImageConfig} ui.config - user config
   * @param {Function} ui.onSelectFile - callback for clicks on Select file button
   * @param {boolean} ui.readOnly - read-only mode flag
   */
  constructor({ api, config, onSelectFile, readOnly, maxWidth }) {
    this.api = api;
    this.config = config;
    this.onSelectFile = onSelectFile;
    this.readOnly = readOnly;
    this.nodes = {
      wrapper: make('div', [this.CSS.baseClass, this.CSS.wrapper]),
      imageContainer: this.createImageContainer(),
      fileButton: this.createFileButton(),
      imageEl: undefined,
      imagePreloader: make('div', this.CSS.imagePreloader),
      caption: make('div', [this.CSS.input, this.CSS.caption], {
        contentEditable: !this.readOnly,
      }),
    };

    /**
     * Create base structure
     *  <wrapper>
     *    <image-container>
     *      <image-preloader />
     *    </image-container>
     *    <caption />
     *    <select-file-button />
     *  </wrapper>
     */
    this.nodes.caption.dataset.placeholder = this.config.captionPlaceholder;
    this.nodes.imageContainer.appendChild(this.nodes.imagePreloader);
    this.nodes.wrapper.appendChild(this.nodes.imageContainer);
    this.nodes.wrapper.appendChild(this.nodes.caption);
    this.nodes.wrapper.appendChild(this.nodes.fileButton);

    this.pinchDistance = 0;
    this.initImageMaxWidth = null;
  }

  /**
   * CSS classes
   *
   * @returns {object}
   */
  get CSS() {
    return {
      baseClass: this.api.styles.block,
      loading: this.api.styles.loader,
      input: this.api.styles.input,
      button: this.api.styles.button,

      /**
       * Tool's classes
       */
      wrapper: 'image-tool',
      imageContainer: 'image-tool__image',
      imagePreloader: 'image-tool__image-preloader',
      imageEl: 'image-tool__image-picture',
      caption: 'image-tool__caption',
    };
  };

  /**
   * Ui statuses:
   * - empty
   * - uploading
   * - filled
   *
   * @returns {{EMPTY: string, UPLOADING: string, FILLED: string}}
   */
  static get status() {
    return {
      EMPTY: 'empty',
      UPLOADING: 'loading',
      FILLED: 'filled',
    };
  }

  /**
   * Renders tool UI
   *
   * @param {ImageToolData} toolData - saved tool data
   * @returns {Element}
   */
  render(toolData) {
    if (!toolData.file || Object.keys(toolData.file).length === 0) {
      this.toggleStatus(Ui.status.EMPTY);
    } else {
      this.toggleStatus(Ui.status.UPLOADING);
    }

    return this.nodes.wrapper;
  }

  /**
   * Creates image container
   *
   * @returns {Element}
   */
  createImageContainer() {
    const container = make('div', [ this.CSS.imageContainer ]);

    container.setAttribute('data-hint', this.api.i18n.t('Shift + Scroll to zoom'));
    container.addEventListener('wheel', (event) => {
      if (event.shiftKey) {
        event.preventDefault();
        if (this.nodes.imageEl) {
          const currentMaxWidth = parseInt(this.nodes.imageEl.style.maxWidth || 100);
          const newMaxWidth = event.deltaY < 0 ? Math.min(100, currentMaxWidth + 5) : Math.max(15, currentMaxWidth - 5);

          this.nodes.imageEl.style.maxWidth = newMaxWidth + '%';
        }
      }
    });

    container.addEventListener('touchstart', (e) => { this.onPinchStart(e); }, { passive: false });
    container.addEventListener('touchmove', (e) => { this.onPinchMove(e); }, { passive: false });
    container.addEventListener('touchend', (e) => this.onPinchEnd(e));

    return container;
  }

  /**
   * Creates upload-file button
   *
   * @returns {Element}
   */
  createFileButton() {
    const button = make('div', [ this.CSS.button ]);

    button.innerHTML = this.config.buttonContent || `${IconPicture} ${this.api.i18n.t('Select an Image')}`;

    button.addEventListener('click', () => {
      this.onSelectFile();
    });

    return button;
  }

  /**
   * Shows uploading preloader
   *
   * @param {string} src - preview source
   * @returns {void}
   */
  showPreloader(src) {
    this.nodes.imagePreloader.style.backgroundImage = `url(${src})`;

    this.toggleStatus(Ui.status.UPLOADING);
  }

  /**
   * Hide uploading preloader
   *
   * @returns {void}
   */
  hidePreloader() {
    this.nodes.imagePreloader.style.backgroundImage = '';
    this.toggleStatus(Ui.status.EMPTY);
  }

  /**
   * Shows an image
   *
   * @param {string} url - image source
   * @param {number} maxWidth - image max width
   * @returns {void}
   */
  fillImage(url, maxWidth = 100) {
    /**
     * Check for a source extension to compose element correctly: video tag for mp4, img — for others
     */
    const tag = /\.mp4$/.test(url) ? 'VIDEO' : 'IMG';

    const attributes = {
      src: url,
      style: `max-width: ${maxWidth}%`,
    };

    /**
     * We use eventName variable because IMG and VIDEO tags have different event to be called on source load
     * - IMG: load
     * - VIDEO: loadeddata
     *
     * @type {string}
     */
    let eventName = 'load';

    /**
     * Update attributes and eventName if source is a mp4 video
     */
    if (tag === 'VIDEO') {
      /**
       * Add attributes for playing muted mp4 as a gif
       *
       * @type {boolean}
       */
      attributes.autoplay = true;
      attributes.loop = true;
      attributes.muted = true;
      attributes.playsinline = true;

      /**
       * Change event to be listened
       *
       * @type {string}
       */
      eventName = 'loadeddata';
    }

    /**
     * Compose tag with defined attributes
     *
     * @type {Element}
     */
    this.nodes.imageEl = make(tag, this.CSS.imageEl, attributes);

    /**
     * Add load event listener
     */
    this.nodes.imageEl.addEventListener(eventName, () => {
      this.toggleStatus(Ui.status.FILLED);

      /**
       * Preloader does not exists on first rendering with presaved data
       */
      if (this.nodes.imagePreloader) {
        this.nodes.imagePreloader.style.backgroundImage = '';
      }
    });

    this.nodes.imageContainer.appendChild(this.nodes.imageEl);
  }

  /**
   * Shows caption input
   *
   * @param {string} text - caption text
   * @returns {void}
   */
  fillCaption(text) {
    if (this.nodes.caption) {
      this.nodes.caption.innerHTML = text;
    }
  }

  /**
   * Changes UI status
   *
   * @param {string} status - see {@link Ui.status} constants
   * @returns {void}
   */
  toggleStatus(status) {
    for (const statusType in Ui.status) {
      if (Object.prototype.hasOwnProperty.call(Ui.status, statusType)) {
        this.nodes.wrapper.classList.toggle(`${this.CSS.wrapper}--${Ui.status[statusType]}`, status === Ui.status[statusType]);
      }
    }
  }

  /**
   * Apply visual representation of activated tune
   *
   * @param {string} tuneName - one of available tunes {@link Tunes.tunes}
   * @param {boolean} status - true for enable, false for disable
   * @returns {void}
   */
  applyTune(tuneName, status) {
    this.nodes.wrapper.classList.toggle(`${this.CSS.wrapper}--${tuneName}`, status);
  }

  /**
   * Helper to get distance between two touches
   *
   * @param {Touch} touch1 - first touch
   * @param {Touch} touch2 - second touch
   * @returns {number} - distance between touches
   */
  getDistance(touch1, touch2) {
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Handle pinch gesture start
   *
   * @param {TouchEvent} event - touch event
   * @returns {void}
   */
  onPinchStart(event) {
    if (this.nodes.imageEl && event.touches.length === 2) {
      event.preventDefault();
      this.pinchDistance = this.getDistance(event.touches[0], event.touches[1]);
      this.initImageMaxWidth = parseFloat(this.nodes.imageEl.style.maxWidth || 100); // Get the current max-width as a percentage
      console.log('start pinch, Init Distance', this.pinchDistance);
    }
  }

  /**
   * Handle pinch gesture move
   *
   * @param {TouchEvent} event - touch event
   * @returns {void}
   */
  onPinchMove(event) {
    if (this.nodes.imageEl && event.touches.length === 2 && this.pinchDistance) {
      event.preventDefault();
      const currentDistance = this.getDistance(event.touches[0], event.touches[1]);
      const ratio = currentDistance / this.pinchDistance;

      console.log('move pinch, Current Distance', currentDistance, 'Ratio', ratio);

      const newWidthPercent = Math.max(10, Math.min(100, this.initImageMaxWidth * ratio));


      this.nodes.imageEl.style.maxWidth = `${Math.round(newWidthPercent)}%`;
    }
  }

  /**
   * Handle pinch gesture end
   *
   * @param {TouchEvent} event - touch event
   * @returns {void}
   */
  onPinchEnd(event) {
    if (event.touches.length < 2) {
      this.pinchDistance = null; // Reset initial distance
      this.initImageMaxWidth = null;// Reset initial max width percentage
    }
  }
}
