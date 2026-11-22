// World knowledge: countries. One compact line each: name|aliases|capital|currency|continent|calling code|main languages
// Stable facts only (no leaders, no populations that change fast).
const RAW = `
Uganda|ugandan|Kampala|Ugandan shilling (UGX)|Africa|+256|English, Swahili, Luganda
Kenya|kenyan|Nairobi|Kenyan shilling (KES)|Africa|+254|English, Swahili
Tanzania|tanzanian|Dodoma (Dar es Salaam is the largest city)|Tanzanian shilling (TZS)|Africa|+255|Swahili, English
Rwanda|rwandan|Kigali|Rwandan franc (RWF)|Africa|+250|Kinyarwanda, French, English, Swahili
Burundi|burundian|Gitega|Burundian franc (BIF)|Africa|+257|Kirundi, French, English
South Sudan|south sudanese|Juba|South Sudanese pound (SSP)|Africa|+211|English
DR Congo|drc,democratic republic of the congo,congo kinshasa|Kinshasa|Congolese franc (CDF)|Africa|+243|French
Republic of the Congo|congo brazzaville|Brazzaville|Central African CFA franc (XAF)|Africa|+242|French
Ethiopia|ethiopian|Addis Ababa|Ethiopian birr (ETB)|Africa|+251|Amharic
Somalia|somali|Mogadishu|Somali shilling (SOS)|Africa|+252|Somali, Arabic
Eritrea|eritrean|Asmara|Eritrean nakfa (ERN)|Africa|+291|Tigrinya, Arabic, English
Djibouti|djiboutian|Djibouti|Djiboutian franc (DJF)|Africa|+253|French, Arabic
Sudan|sudanese|Khartoum|Sudanese pound (SDG)|Africa|+249|Arabic, English
Egypt|egyptian|Cairo|Egyptian pound (EGP)|Africa|+20|Arabic
Libya|libyan|Tripoli|Libyan dinar (LYD)|Africa|+218|Arabic
Tunisia|tunisian|Tunis|Tunisian dinar (TND)|Africa|+216|Arabic
Algeria|algerian|Algiers|Algerian dinar (DZD)|Africa|+213|Arabic, Berber
Morocco|moroccan|Rabat|Moroccan dirham (MAD)|Africa|+212|Arabic, Berber
Nigeria|nigerian|Abuja (Lagos is the largest city)|Nigerian naira (NGN)|Africa|+234|English
Ghana|ghanaian|Accra|Ghanaian cedi (GHS)|Africa|+233|English
Senegal|senegalese|Dakar|West African CFA franc (XOF)|Africa|+221|French, Wolof
Ivory Coast|cote d'ivoire,côte d'ivoire|Yamoussoukro (Abidjan is the largest city)|West African CFA franc (XOF)|Africa|+225|French
Mali|malian|Bamako|West African CFA franc (XOF)|Africa|+223|French
Niger|nigerien|Niamey|West African CFA franc (XOF)|Africa|+227|French
Burkina Faso||Ouagadougou|West African CFA franc (XOF)|Africa|+226|French
Cameroon|cameroonian|Yaoundé|Central African CFA franc (XAF)|Africa|+237|French, English
Chad|chadian|N'Djamena|Central African CFA franc (XAF)|Africa|+235|French, Arabic
Gabon|gabonese|Libreville|Central African CFA franc (XAF)|Africa|+241|French
Angola|angolan|Luanda|Angolan kwanza (AOA)|Africa|+244|Portuguese
Zambia|zambian|Lusaka|Zambian kwacha (ZMW)|Africa|+260|English
Zimbabwe|zimbabwean|Harare|Zimbabwe Gold (ZiG); US dollar widely used|Africa|+263|English, Shona, Ndebele
Malawi|malawian|Lilongwe|Malawian kwacha (MWK)|Africa|+265|English, Chichewa
Mozambique|mozambican|Maputo|Mozambican metical (MZN)|Africa|+258|Portuguese
Madagascar|malagasy|Antananarivo|Malagasy ariary (MGA)|Africa|+261|Malagasy, French
Mauritius|mauritian|Port Louis|Mauritian rupee (MUR)|Africa|+230|English, French
Namibia|namibian|Windhoek|Namibian dollar (NAD)|Africa|+264|English
Botswana|motswana|Gaborone|Botswana pula (BWP)|Africa|+267|English, Setswana
South Africa|south african|Pretoria (administrative), Cape Town (legislative), Bloemfontein (judicial)|South African rand (ZAR)|Africa|+27|11 official languages incl. Zulu, Xhosa, Afrikaans, English
Lesotho|basotho|Maseru|Lesotho loti (LSL)|Africa|+266|Sesotho, English
Eswatini|swaziland|Mbabane (administrative), Lobamba (legislative)|Swazi lilangeni (SZL)|Africa|+268|siSwati, English
Sierra Leone|sierra leonean|Freetown|Sierra Leonean leone (SLE)|Africa|+232|English
Liberia|liberian|Monrovia|Liberian dollar (LRD)|Africa|+231|English
Gambia|the gambia,gambian|Banjul|Gambian dalasi (GMD)|Africa|+220|English
Togo|togolese|Lomé|West African CFA franc (XOF)|Africa|+228|French
Benin|beninese|Porto-Novo (Cotonou is the largest city)|West African CFA franc (XOF)|Africa|+229|French
France|french|Paris|Euro (EUR)|Europe|+33|French
Germany|german|Berlin|Euro (EUR)|Europe|+49|German
Italy|italian|Rome|Euro (EUR)|Europe|+39|Italian
Spain|spanish|Madrid|Euro (EUR)|Europe|+34|Spanish
Portugal|portuguese|Lisbon|Euro (EUR)|Europe|+351|Portuguese
United Kingdom|uk,britain,great britain,british,england|London|Pound sterling (GBP)|Europe|+44|English
Ireland|irish|Dublin|Euro (EUR)|Europe|+353|English, Irish
Netherlands|holland,dutch|Amsterdam|Euro (EUR)|Europe|+31|Dutch
Belgium|belgian|Brussels|Euro (EUR)|Europe|+32|Dutch, French, German
Switzerland|swiss|Bern|Swiss franc (CHF)|Europe|+41|German, French, Italian, Romansh
Austria|austrian|Vienna|Euro (EUR)|Europe|+43|German
Sweden|swedish|Stockholm|Swedish krona (SEK)|Europe|+46|Swedish
Norway|norwegian|Oslo|Norwegian krone (NOK)|Europe|+47|Norwegian
Denmark|danish|Copenhagen|Danish krone (DKK)|Europe|+45|Danish
Finland|finnish|Helsinki|Euro (EUR)|Europe|+358|Finnish, Swedish
Poland|polish|Warsaw|Polish złoty (PLN)|Europe|+48|Polish
Greece|greek|Athens|Euro (EUR)|Europe|+30|Greek
Turkey|turkish|Ankara|Turkish lira (TRY)|Europe/Asia|+90|Turkish
Russia|russian|Moscow|Russian rouble (RUB)|Europe/Asia|+7|Russian
Ukraine|ukrainian|Kyiv|Ukrainian hryvnia (UAH)|Europe|+380|Ukrainian
United States|usa,us,america,united states of america,american|Washington, D.C.|US dollar (USD)|North America|+1|English
Canada|canadian|Ottawa|Canadian dollar (CAD)|North America|+1|English, French
Mexico|mexican|Mexico City|Mexican peso (MXN)|North America|+52|Spanish
Cuba|cuban|Havana|Cuban peso (CUP)|North America|+53|Spanish
Jamaica|jamaican|Kingston|Jamaican dollar (JMD)|North America|+1 876|English
Brazil|brazilian|Brasília|Brazilian real (BRL)|South America|+55|Portuguese
Argentina|argentine,argentinian|Buenos Aires|Argentine peso (ARS)|South America|+54|Spanish
Chile|chilean|Santiago|Chilean peso (CLP)|South America|+56|Spanish
Colombia|colombian|Bogotá|Colombian peso (COP)|South America|+57|Spanish
Peru|peruvian|Lima|Peruvian sol (PEN)|South America|+51|Spanish, Quechua
Venezuela|venezuelan|Caracas|Venezuelan bolívar (VES)|South America|+58|Spanish
China|chinese|Beijing|Chinese yuan / renminbi (CNY)|Asia|+86|Mandarin Chinese
Japan|japanese|Tokyo|Japanese yen (JPY)|Asia|+81|Japanese
South Korea|korea,south korean|Seoul|South Korean won (KRW)|Asia|+82|Korean
North Korea|north korean|Pyongyang|North Korean won (KPW)|Asia|+850|Korean
India|indian|New Delhi|Indian rupee (INR)|Asia|+91|Hindi, English and many others
Pakistan|pakistani|Islamabad|Pakistani rupee (PKR)|Asia|+92|Urdu, English
Bangladesh|bangladeshi|Dhaka|Bangladeshi taka (BDT)|Asia|+880|Bengali
Sri Lanka|sri lankan|Sri Jayawardenepura Kotte (Colombo is the largest city)|Sri Lankan rupee (LKR)|Asia|+94|Sinhala, Tamil
Nepal|nepali,nepalese|Kathmandu|Nepalese rupee (NPR)|Asia|+977|Nepali
Indonesia|indonesian|Jakarta|Indonesian rupiah (IDR)|Asia|+62|Indonesian
Philippines|filipino|Manila|Philippine peso (PHP)|Asia|+63|Filipino, English
Vietnam|vietnamese|Hanoi|Vietnamese dong (VND)|Asia|+84|Vietnamese
Thailand|thai|Bangkok|Thai baht (THB)|Asia|+66|Thai
Malaysia|malaysian|Kuala Lumpur|Malaysian ringgit (MYR)|Asia|+60|Malay
Singapore|singaporean|Singapore|Singapore dollar (SGD)|Asia|+65|English, Malay, Mandarin, Tamil
Saudi Arabia|saudi|Riyadh|Saudi riyal (SAR)|Asia|+966|Arabic
United Arab Emirates|uae,emirates,emirati|Abu Dhabi (Dubai is the largest city)|UAE dirham (AED)|Asia|+971|Arabic
Qatar|qatari|Doha|Qatari riyal (QAR)|Asia|+974|Arabic
Iran|iranian|Tehran|Iranian rial (IRR)|Asia|+98|Persian
Iraq|iraqi|Baghdad|Iraqi dinar (IQD)|Asia|+964|Arabic, Kurdish
Israel|israeli|Jerusalem (disputed; Tel Aviv hosts most embassies)|Israeli shekel (ILS)|Asia|+972|Hebrew, Arabic
Afghanistan|afghan|Kabul|Afghan afghani (AFN)|Asia|+93|Pashto, Dari
Australia|australian|Canberra|Australian dollar (AUD)|Oceania|+61|English
New Zealand|kiwi,new zealander|Wellington|New Zealand dollar (NZD)|Oceania|+64|English, Māori
`;
export interface Country { name: string; aliases: string[]; capital: string; currency: string; continent: string; code: string; languages: string }
export const COUNTRIES: Country[] = RAW.trim().split('\n').map((l) => {
  const [name, al, capital, currency, continent, code, languages] = l.split('|');
  return { name, aliases: (al || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean), capital, currency, continent, code, languages };
});
