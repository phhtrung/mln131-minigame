(() => {
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(location.search).get('motion') === 'full';
  if (motion) document.documentElement.classList.add('full-motion');

  const heading = document.querySelector('.title-line');
  const stage = document.querySelector('#round');
  const picture = document.querySelector('.picture-mask');
  const image = document.querySelector('#picture');
  const hint = document.querySelector('#hint');
  const answer = document.querySelector('#answer');
  const answerBlock = document.querySelector('#answer-block');
  const actions = document.querySelector('.actions');
  const reveal = document.querySelector('#reveal');
  const next = document.querySelector('#next');
  let round = 0;
  let animations = [];

  const words = (element, value) => {
    element.replaceChildren(...value.split(/(\s+)/u).map(piece => {
      if (/^\s+$/u.test(piece)) return document.createTextNode(piece);
      const mask = document.createElement('span');
      mask.className = 'word-mask';
      const word = document.createElement('span');
      word.className = 'word';
      word.textContent = piece;
      mask.append(word);
      return mask;
    }));
  };
  const play = (element, frames, duration, delay = 0) => {
    const animation = element.animate(frames, {
      duration, delay, easing: 'cubic-bezier(.26,1,.48,1)', fill: 'both',
    });
    animations.push(animation);
    return animation.finished.catch(() => {});
  };
  const clearAnimations = () => {
    animations.forEach(animation => animation.cancel());
    animations = [];
  };
  const textMotion = (element, entering, delay = 0) => {
    if (!motion) return [];
    return [...element.querySelectorAll('.word')].map((word, index) =>
      play(word, entering
        ? [{ transform: 'translate3d(0,110%,0)' }, { transform: 'translate3d(0,0,0)' }]
        : [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-110%,0)' }],
      entering ? 1200 : 650, delay + Math.min(index * 100, 450)));
  };
  const lineMotion = (element, entering, delay = 0) => play(element,
    entering ? [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }]
      : [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
    entering ? 950 : 550, delay);
  const buttonMotion = (button, entering, delay = 0) => play(button,
    entering ? [{ opacity: 0, transform: 'scale(.72)' }, { opacity: 1, transform: 'scale(1)' }]
      : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.72)' }],
    entering ? 1000 : 550, delay);
  const pictureMotion = (entering, delay = 0) => [
    play(picture, entering
      ? [{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0 0 0 0)' }]
      : [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(50% 0 50% 0)' }],
    entering ? 1000 : 600, delay),
    play(image, entering
      ? [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }]
      : [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }],
    entering ? 1200 : 600, delay),
  ];
  const enterScreen = () => {
    if (!motion) return;
    play(heading, [{ transform: 'translate3d(0,110%,0)' }, { transform: 'translate3d(0,0,0)' }], 1200, 50);
    lineMotion(stage.querySelector(':scope > .rule'), true, 100);
    pictureMotion(true, 150);
    textMotion(hint, true, 190);
    lineMotion(actions.querySelector('.rule'), true, 350);
    buttonMotion(reveal, true, 450);
  };
  const exitScreen = () => {
    if (!motion) return Promise.resolve();
    return Promise.all([
      play(heading, [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-110%,0)' }], 650),
      lineMotion(stage.querySelector(':scope > .rule'), false, 100),
      ...pictureMotion(false),
      ...textMotion(hint, false),
      ...textMotion(answer, false),
      lineMotion(actions.querySelector('.rule'), false, 100),
      buttonMotion(answerBlock.hidden ? reveal : next, false),
      ...(answerBlock.hidden ? [] : [lineMotion(answerBlock.querySelector('.rule'), false)]),
    ]);
  };
  const render = () => {
    const item = rounds[round];
    stage.setAttribute('aria-label', `Vòng ${round + 1} trên ${rounds.length}`);
    image.src = item.image;
    image.alt = `Hình gợi ý cho vòng ${round + 1}`;
    words(hint, item.hint);
    answer.replaceChildren();
    answerBlock.hidden = true;
    reveal.hidden = false;
    reveal.disabled = false;
    next.hidden = true;
    next.firstChild.textContent = round === rounds.length - 1 ? 'Chơi lại ' : 'Vòng tiếp theo ';
    next.querySelector('span').textContent = round === rounds.length - 1 ? '↺' : '→';
  };

  render();
  image.decode().catch(() => {}).then(enterScreen);

  reveal.addEventListener('click', async () => {
    reveal.disabled = true;
    document.documentElement.classList.add('revealed');
    if (motion) await buttonMotion(reveal, false);
    clearAnimations();
    words(answer, rounds[round].answer);
    answerBlock.hidden = false;
    reveal.hidden = true;
    next.hidden = false;
    if (motion) {
      lineMotion(answerBlock.querySelector('.rule'), true);
      textMotion(answer, true, 130);
      buttonMotion(next, true, 250);
    }
  });

  next.addEventListener('click', async () => {
    next.disabled = true;
    const upcoming = new Image();
    upcoming.src = rounds[(round + 1) % rounds.length].image;
    const ready = upcoming.decode().catch(() => {});
    document.documentElement.classList.remove('revealed');
    await exitScreen();
    document.documentElement.classList.add('is-changing');
    clearAnimations();
    await ready;
    round = (round + 1) % rounds.length;
    render();
    await image.decode().catch(() => {});
    window.scrollTo({ top: 0, behavior: 'instant' });
    enterScreen();
    document.documentElement.classList.remove('is-changing');
    next.disabled = false;
  });
})();
