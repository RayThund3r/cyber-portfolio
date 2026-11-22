// World knowledge: dates/events and well-known people. Only well-established facts; no current office-holders.
// EVENTS: key words|year/date|what
const EV = `
world war 1|world war i|first world war|ww1|wwi|1914 to 1918|The First World War, 28 July 1914 to 11 November 1918
world war 2|world war ii|second world war|ww2|wwii|1939 to 1945|The Second World War, 1 September 1939 (Germany invades Poland) to 1945 (Europe: 8 May; Japan: 2 September)
french revolution|1789|The French Revolution began in 1789 with the storming of the Bastille on 14 July
american independence|declaration of independence|american revolution|1776|The US Declaration of Independence was adopted on 4 July 1776
abolition of slavery in britain|slavery abolition act|1833|Britain's Slavery Abolition Act was passed in 1833
berlin conference|scramble for africa|1884 to 1885|The Berlin Conference of 1884 to 1885 set rules for European colonisation of Africa
uganda independence|uganda independent|9 october 1962|Uganda became independent from Britain on 9 October 1962; Milton Obote was the first executive prime minister
uganda protectorate|uganda british protectorate|1894|Britain declared the Uganda Protectorate in 1894
kenya independence|12 december 1963|Kenya became independent on 12 December 1963; Jomo Kenyatta became the first prime minister and then president
tanzania independence|tanganyika independence|9 december 1961|Tanganyika became independent on 9 December 1961; it united with Zanzibar in April 1964 to form Tanzania
ghana independence|6 march 1957|Ghana became the first sub-Saharan African country to gain independence from colonial rule, on 6 March 1957, under Kwame Nkrumah
nigeria independence|1 october 1960|Nigeria became independent on 1 October 1960
rwanda genocide|1994|The genocide against the Tutsi in Rwanda took place from April to July 1994
end of apartheid|south africa first democratic election|27 april 1994|South Africa held its first fully democratic election on 27 April 1994; Nelson Mandela became president
mandela released|nelson mandela release|11 february 1990|Nelson Mandela was released from prison on 11 February 1990 after 27 years
berlin wall fall|fall of the berlin wall|9 november 1989|The Berlin Wall fell on 9 November 1989
moon landing|apollo 11|20 july 1969|Apollo 11 landed the first humans on the Moon on 20 July 1969; Neil Armstrong and Buzz Aldrin walked on it
first man in space|yuri gagarin|12 april 1961|Yuri Gagarin became the first human in space on 12 April 1961
first computer|eniac|1945|ENIAC, one of the first general-purpose electronic computers, was completed in 1945
world wide web invented|www invented|1989|Tim Berners-Lee proposed the World Wide Web in 1989; the first website went live in 1991
first iphone|iphone released|29 june 2007|The first iPhone went on sale on 29 June 2007
first email|email invented|1971|Ray Tomlinson sent the first networked email in 1971 and chose the @ sign
google founded|google started|4 september 1998|Google was founded on 4 September 1998 by Larry Page and Sergey Brin
facebook founded|facebook started|4 february 2004|Facebook was launched on 4 February 2004 by Mark Zuckerberg and co-founders
youtube founded|youtube started|2005|YouTube was founded in February 2005; the first video was uploaded on 23 April 2005
whatsapp founded|whatsapp started|2009|WhatsApp was founded in 2009 and bought by Facebook in 2014
titanic|titanic sank|15 april 1912|The Titanic sank on 15 April 1912 after hitting an iceberg on its first voyage
chernobyl|chernobyl disaster|26 april 1986|The Chernobyl nuclear disaster happened on 26 April 1986 in Ukraine (then the USSR)
september 11|9/11|11 september 2001|The 11 September 2001 attacks in the USA
covid pandemic|covid 19 start|2020|The WHO declared COVID-19 a pandemic on 11 March 2020
columbus|columbus america|1492|Christopher Columbus reached the Americas in 1492
industrial revolution|1760 to 1840|The Industrial Revolution began in Britain in the late 1700s, with steam power and factories
printing press|gutenberg|around 1440|Johannes Gutenberg introduced movable-type printing in Europe around 1440
fall of the roman empire|roman empire fall|476|The Western Roman Empire is traditionally said to have fallen in 476 CE
renaissance|14th to 17th century|The Renaissance was a cultural rebirth in Europe from roughly the 14th to the 17th century, starting in Italy
cold war|1947 to 1991|The Cold War was the tension between the USA and the Soviet Union, from about 1947 until the USSR dissolved in 1991
united nations founded|un founded|24 october 1945|The United Nations was founded on 24 October 1945
african union founded|au founded|oau founded|2002|The African Union replaced the Organization of African Unity (founded 1963) in 2002
east african community|eac founded|eac revived|2000|The current East African Community was revived in 2000
makerere university|makerere founded|1922|Makerere University in Kampala was founded in 1922 as a technical school and is one of Africa's oldest universities
kampala capital|kampala history|1962|Kampala became the capital of independent Uganda in 1962; Entebbe had been the colonial capital
idi amin|amin regime|1971 to 1979|Idi Amin ruled Uganda from the 1971 coup until he was overthrown in 1979
museveni nrm|nrm takes power|26 january 1986|Yoweri Museveni's National Resistance Army took power in Uganda on 26 January 1986
`;
export interface Event { keys: string[]; when: string; what: string }
export const EVENTS: Event[] = EV.trim().split('\n').map((l) => { const p = l.split('|'); const what = p.pop()!; const when = p.pop()!; return { keys: p, when, what }; });

// PEOPLE: name|aliases|lived|known for
const PE = `
Albert Einstein|einstein|1879 to 1955|German-born physicist who developed the theory of relativity and won the 1921 Nobel Prize in Physics
Isaac Newton|newton|1643 to 1727|English mathematician and physicist known for the laws of motion and universal gravitation
Galileo Galilei|galileo|1564 to 1642|Italian astronomer who improved the telescope and supported the Sun-centred model of the Solar System
Charles Darwin|darwin|1809 to 1882|English naturalist who proposed evolution by natural selection in On the Origin of Species (1859)
Marie Curie|curie|1867 to 1934|Polish-French scientist who pioneered research on radioactivity and won Nobel Prizes in Physics and Chemistry
Nikola Tesla|tesla|1856 to 1943|Serbian-American inventor who advanced alternating-current electricity
Thomas Edison|edison|1847 to 1931|American inventor known for the practical light bulb and the phonograph
Alexander Graham Bell|graham bell,bell|1847 to 1922|Scottish-born inventor credited with patenting the telephone in 1876
Alan Turing|turing|1912 to 1954|British mathematician and computing pioneer who helped break the Enigma code and laid foundations for computer science
Ada Lovelace|lovelace|1815 to 1852|English mathematician who wrote what is considered the first computer program
Charles Babbage|babbage|1791 to 1871|English mathematician who designed the first mechanical programmable computer
Tim Berners-Lee|berners-lee,timothy berners-lee|born 1955|British computer scientist who invented the World Wide Web
Bill Gates|gates|born 1955|co-founder of Microsoft and a major philanthropist
Steve Jobs|jobs|1955 to 2011|co-founder of Apple, behind the Mac, iPod, iPhone and iPad
Mark Zuckerberg|zuckerberg|born 1984|co-founder and CEO of Facebook (Meta)
Jeff Bezos|bezos|born 1964|founder of Amazon
Elon Musk|musk|born 1971|entrepreneur behind Tesla, SpaceX and other companies; born in Pretoria, South Africa
Larry Page|page|born 1973|co-founder of Google
Sergey Brin|brin|born 1973|co-founder of Google
Linus Torvalds|torvalds|born 1969|Finnish-American creator of the Linux kernel and Git
Guido van Rossum|rossum|born 1956|Dutch programmer who created Python
Mahatma Gandhi|gandhi|1869 to 1948|Indian leader of the non-violent independence movement
Nelson Mandela|mandela|1918 to 2013|anti-apartheid leader who became South Africa's first democratically elected president in 1994
Martin Luther King Jr.|martin luther king,mlk|1929 to 1968|American civil-rights leader famous for his 'I Have a Dream' speech
Abraham Lincoln|lincoln|1809 to 1865|16th US president who led the country through the Civil War and ended slavery
George Washington|washington|1732 to 1799|first president of the United States
Winston Churchill|churchill|1874 to 1965|British prime minister during most of the Second World War
Napoleon Bonaparte|napoleon|1769 to 1821|French military leader and emperor
Julius Caesar|caesar|100 BC to 44 BC|Roman general and statesman
Cleopatra|cleopatra vii|69 BC to 30 BC|the last active ruler of Ptolemaic Egypt
Alexander the Great|alexander|356 BC to 323 BC|Macedonian king who built one of the largest empires of the ancient world
William Shakespeare|shakespeare|1564 to 1616|English playwright and poet, author of Hamlet, Macbeth and Romeo and Juliet
Leonardo da Vinci|da vinci,leonardo|1452 to 1519|Italian artist and inventor who painted the Mona Lisa and The Last Supper
Michelangelo||1475 to 1564|Italian sculptor and painter of the Sistine Chapel ceiling and the statue of David
Vincent van Gogh|van gogh|1853 to 1890|Dutch painter of The Starry Night and Sunflowers
Pablo Picasso|picasso|1881 to 1973|Spanish artist who co-founded Cubism
Wolfgang Amadeus Mozart|mozart|1756 to 1791|Austrian composer
Ludwig van Beethoven|beethoven|1770 to 1827|German composer of nine symphonies
Aristotle||384 BC to 322 BC|Greek philosopher and student of Plato who tutored Alexander the Great
Plato||about 428 BC to 348 BC|Greek philosopher who founded the Academy in Athens
Socrates||about 470 BC to 399 BC|Greek philosopher known for questioning to find truth
Confucius||551 BC to 479 BC|Chinese philosopher whose teachings shaped East Asian culture
Kwame Nkrumah|nkrumah|1909 to 1972|first prime minister and president of independent Ghana and a Pan-Africanist
Jomo Kenyatta|kenyatta|about 1897 to 1978|first president of independent Kenya
Julius Nyerere|nyerere|1922 to 1999|first president of Tanzania
Milton Obote|obote|1925 to 2005|Uganda's first prime minister at independence in 1962 and later president
Idi Amin|amin|about 1925 to 2003|military ruler of Uganda from 1971 to 1979
Yoweri Museveni|museveni|born 1944|Ugandan politician who has led Uganda since 1986
Mutesa II|kabaka freddie,edward mutesa|1924 to 1969|Kabaka (king) of Buganda and Uganda's first president from 1963 to 1966
Wangari Maathai|maathai|1940 to 2011|Kenyan environmentalist who founded the Green Belt Movement and won the 2004 Nobel Peace Prize
Chinua Achebe|achebe|1930 to 2013|Nigerian author of Things Fall Apart
Wole Soyinka|soyinka|born 1934|Nigerian writer, the first African to win the Nobel Prize in Literature (1986)
Haile Selassie|selassie|1892 to 1975|Emperor of Ethiopia from 1930 to 1974
Cecil Rhodes|rhodes|1853 to 1902|British colonial businessman in southern Africa
David Livingstone|livingstone|1813 to 1873|Scottish missionary and explorer in Africa
John Hanning Speke|speke|1827 to 1864|British explorer who identified Lake Victoria as the source of the Nile in 1858
Joseph Kony|kony|born 1961|Ugandan rebel leader of the Lord's Resistance Army
Stephen Hawking|hawking|1942 to 2018|British physicist known for his work on black holes and A Brief History of Time
Sigmund Freud|freud|1856 to 1939|Austrian founder of psychoanalysis
Pythagoras||about 570 BC to 495 BC|Greek mathematician known for the Pythagorean theorem
Archimedes||about 287 BC to 212 BC|Greek mathematician and inventor
Louis Pasteur|pasteur|1822 to 1895|French scientist who developed pasteurisation and early vaccines
Alexander Fleming|fleming|1881 to 1955|Scottish scientist who discovered penicillin in 1928
Wright brothers|orville wright,wilbur wright|1867 to 1948|American aviation pioneers who made the first powered flight in 1903
Henry Ford|ford|1863 to 1947|American industrialist who made cars affordable with the assembly line
Guglielmo Marconi|marconi|1874 to 1937|Italian inventor who developed practical radio
Johannes Gutenberg|gutenberg|about 1400 to 1468|German inventor of movable-type printing in Europe
`;
export interface Person { name: string; aliases: string[]; lived: string; known: string }
export const PEOPLE: Person[] = PE.trim().split('\n').map((l) => { const [name, al, lived, known] = l.split('|'); return { name, aliases: (al || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean), lived, known }; });
