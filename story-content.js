window.VesperChapter = {
  title: 'The Forgotten Crypt',
  opening: 'Three hundred years ago, a king commanded death to kneel.\n\nThe castle still waits for its answer.\n\nYou wake beneath Castle Vesper. No name. No memory. Only the impression of a crown pressed into your palm.',
  knight: {
    greeting: { text: 'You wake again. Do not ask how I know. The stones remember the shape of everyone who lies upon them.', choices: [['Where am I?', 'crypt'], ['Do you know me?', 'identity'], ['How do I leave?', 'escape']] },
    crypt: { text: 'The Forgotten Crypt. Above us, a king’s castle. Below us… no one has returned to say. Three centuries, and still the bells refuse to mark a morning.', choices: [['What happened here?', 'ritual'], ['How do I leave?', 'escape']] },
    ritual: { text: 'Our king would not surrender to the grave. He offered the castle in his place. Now the dead rise, and the living forget which they were.', choices: [['And the crown?', 'crown'], ['I should go.', null]] },
    identity: { text: 'I knew someone with your eyes. They stood beside the throne when the candles went out. Forgive me. Memory is a cruel witness.', choices: [['What throne?', 'ritual'], ['I need a way out.', 'escape']] },
    escape: { text: 'Break the seal. Silence the Crypt Keeper at the far stair. Take what he guards; the broken crown remembers doors that we have forgotten.', choices: [['Tell me about the crown.', 'crown'], ['Then I will find the stair.', null]] },
    crown: { text: 'A sliver is still a crown, to the hand that wore it. If it feels warm, do not tell me. I have so few loyalties left.', choices: [['I will remember your warning.', null]] }
  },
  lore: {
    letter: { title: 'An unsent letter', text: 'Mother,\nThe bells rang at midnight, though no one pulled the ropes. The king has dismissed his physicians. He speaks only to the man behind the black veil.\nIf this reaches you, do not come for me.\n— A.' },
    book: { title: 'The burial register', text: 'Year 1: forty-seven names.\nYear 2: the same forty-seven.\nYear 300: we no longer write the names.\n\nIn another hand: One grave is always empty.' },
    inscription: { title: 'Words beneath the seal', text: 'LET NO CROWN PASS WHOLE INTO THE EARTH.\n\nSomeone has scratched beneath it:\nHe did not fear dying. He feared being forgotten.' }
  },
  memories: [
    'A candlelit hall. Your hand rests on a throne. Someone whispers: “Not yet, my liege.”',
    'You remember a crown breaking against stone. You remember being the one who let it fall.',
    'A knight kneels before you. You order him to forget your face. He is weeping inside his helm.'
  ]
};
