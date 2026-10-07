<!-- autoi18n: source=admin.md lang=az sha1=7d26cad2d0cb10c0c181b6996cc82e5363b198e1 -->
# Platformada necə işləmək olar

Administrator müəllimlərin gördüyü hər şeyi görür — amma bütün qruplar və bütün müəllimlər üzrə — və əlavə olaraq istifadəçiləri, kursları və qrupları idarə edir.

## Qruplar

[Əsas səhifədə](/dashboard) — platformanın bütün qrupları. Müəllimə görə filtr və ya **Mənim** — yalnız sizin müəllim olduğunuz qruplar. Qrupları **cədvəl** və ya **dərs təqvimi** ilə baxmaq mümkündür, orada **arxiv** də var.

Qrupa klikləyin — onun səhifəsi açılacaq: parametrlər, şagirdlərin qeydiyyatı üçün QR, tərkibi, cədvəl və dərslər. Qrupla və dərslərlə iş müəllimlə eynidir: dərslər, jurnal, ev tapşırıqları, quizlər, şagirdlərlə dialoq.

### Dərslərin müəllimi

Qrupun əsas müəllimi var, hər dərsin isə öz müəllimi: adətən eyni, amma bir və ya bir neçə dərs üçün başqa müəllim təyin etmək mümkündür. Qrup səhifəsində **Dərslərin müəllimi** düyməsini basın və müəllimi seçin, hansı dərsdən və hansı dərsə qədər.

- **Dəyişmə** — bir və ya bir neçə dərsi seçin. Qrupun əsas müəllimi dəyişmir. Dəyişən yalnız bu dərsləri görür və hər birində dərs günü gecə yarısına qədər işləyir, sonra dərs ona baxmaq üçün qalır.
- **Qrupun ötürülməsi** — qrupun keçəcəyi dərsi seçin və "sonuna qədər". Müəllim əsas olur: bütün qrupu və bütün dərsləri alır, yeni dərslər onun adına yaradılır. Əvvəlki müəllim yalnız öz apardığı dərsləri görür və onlarda heç nəyi dəyişmir.
- **Əvvəlki müəllim kim olub** — əgər qrup artıq ötürülmüşsə, əvvəlki müəllimi onun apardığı dərslərə təyin edin.

Dərsi silmək və ya köçürmək və onun iştirakçılarını dəyişdirmək yalnız qrupun əsas müəllimi tərəfindən mümkündür. Ev tapşırıqlarını da o yoxlayır. Hesabatlarda və "Müəllimlər" bölməsində dərs, müəllim kimi qeyd olunan şəxsə aiddir.

## Admin

[Admin](/dashboard/admin) bölməsində dörd sekme var.

### Müəllimlər və Administratorlar

İstifadəçi siyahısı: ad, giriş, telefon.

- **+ Müəllim əlavə et** / **+ Administrator əlavə et** — yeni istifadəçi giriş və şifrə ilə; o, dərhal daxil ola bilər.
- Sətirə vurun — məlumatları dəyişmək mümkündür.
- Silinmə: sistem istifadəçi ilə bağlı olanları göstərəcək və təsdiq tələb edəcək.

### Kurslar

Kursun adı və təsviri. **+ Kurs əlavə et**, sətirə vurmaqla dəyişiklik, silinmə.

### Qruplar

Ad, kurs, sektor, müəllim, videokonfrans, Telegram.

- **+ Qrup əlavə et** — kurs və müəllim ilə yeni qrup.
- Sətirə vurun — məlumatları dəyişmək mümkündür. Müəllimin dəyişdirilməsi sətirdə bu gündən etibarən qüvvədədir: keçmiş dərslər onları aparan müəllimə aiddir.
- **Qrup cədvəli** — qrup səhifəsini açın.
- **Arxivə göndər** — qrup artıq aktiv deyil; arxivdən onu **geri qaytarmaq** və ya **tamamilə silmək** mümkündür.

## Bilik bazası

[Базе знаний](/dashboard/materials) bölməsində administrator üçün əlavə:

- **Kurs yüklə** — dərs şablonu kimi kurs materialları ilə qovluğu yükləyin: hər bir fayl üçün kurs, istiqamət və dərs nömrəsi göstərilir.
- Kurs və sektor üzrə filtr və dərs şablonlarından materialların göstərilməsi.
- **Təsdiq et** / **Blokla** şablon materialını — tək-tək və ya kursun bütün paketini.
- Faylları və bağlantıları yalnız administrator silə bilər; quiz — administrator və ya onun müəllifi. Dərslərdə istifadə olunan material əvvəlcə ayrılmalıdır.

## Tələbələr

[Tələbələr](/dashboard/students) bölməsində — platformanın bütün şagirdləri: qrup, müəllim, dərslər üzrə orta qiymətlər, Ev tapşırığı və imtahanlar, ulduzlar, buraxmalar, gecikmələr, son giriş tarixi, telefon, valideyn və əlaqələr. Müəllim, kurs və qrup üzrə filtr, **Mənim** — yalnız sizin qruplarınız. Sütun adının üzərinə vurun — cədvəl ona görə sıralanacaq.

Adın altında olan rəngli zolaq — son verilmiş Ev tapşırığı üzrə borc: narıncı — şagird hələ cavab verməyib və ya Ev tapşırığı düzəliş üçün geri qaytarılıb, qırmızı — təqdim etmə müddəti keçib. Zolaq, şagird cavab göndərdikdə yox olur.

"Buraxmalar" sütununda — yalnız üzrlü səbəb olmadan bağlanmamış buraxmalar. Buraxmaların sayının ətrafında qırmızı halqa — şagird son dərsi buraxıb və ondan sonra fərdi dərsdə olmayıb. Halqa dərsdən sonraki gün görünür. O, fərdi dərs bitdikdə və şagird orada "Gəldi" və ya "Onlayn" qeyd edildikdə, ya da şagird növbəti qrup dərsinə gəldikdə yox olur; üzrlü səbəb ilə buraxma halqa vermir.

Fərdi dərs buraxmaları bağlayır: o bitdikdə və şagird orada "Gəldi" və ya "Onlayn" qeyd edildikdə, bu gündən əvvəlki bütün buraxmalar bağlanmış sayılır. Bağlanmış buraxma şagirdin hesabatında qeyd ilə görünür, lakin buraxmaların sayına və davamiyyət faizinə daxil edilmir.

### Şagird necə əlavə olunur

1. **+ Şagird** düyməsini basın.
2. Ad, soyad, telefon, istifadəçi adı və şifrəni doldurun. İstifadəçi adı və şifrəni sonra şagirdə verməlisiniz.
3. Valideynin adını və telefonunu yazın.
4. Qrupu seçin və **Saxla** düyməsini basın. Şagird dərhal qrupda görünəcək və daxil ola biləcək.

### Şagirdin məlumatlarını necə dəyişmək olar

Şagirdin sətirindəki **qələm** ikoncasını basın. Pəncərədə ad, telefon, email, Telegram, WhatsApp, valideynin adı və telefonunu dəyişmək mümkündür. İstifadəçi adını dəyişmək olmaz.

### Telefonlar üçün qaydalar

- Şagirdin telefonu mütləqdir. Siyahıda "Telefon" sütununda qırmızı xətt varsa, bu, telefonun doldurulmadığını göstərir; belə bir şagird sistemdən daxil olarkən telefonunu göstərməsini tələb edəcək.
- Eyni telefon iki istifadəçidə ola bilməz. Əgər sistem telefonun artıq olduğunu bildirirsə, deməli şagird artıq əlavə edilib — onu siyahıda tapın.
- Əgər uşağın öz telefonu yoxdursa, valideynin telefonunu hər iki sahəyə yazın: "Şagirdin telefonu" və "Valideynin telefonu".
- Valideynin telefonu təkrarlana bilər: qardaşlar və bacılar üçün bir dənədir.
- Nömrəni +994 50 123 45 67 və ya 050 123 45 67 kimi daxil edə bilərsiniz; başqa ölkənin nömrəsi — plussuz və ölkə kodu ilə.

### Digər əməliyyatlar

- **Şifrəni dəyişmək** (açar) — əgər şagird şifrəsini unutmuşdursa. Yeni şifrə sistemdə ekranda göstəriləcək, onu şagirdə bildirmək lazımdır.
- **Silmək** (tullantı) — sistem şagirdlə bağlı olanları göstərəcək və təsdiq tələb edəcək.
- Şagirdi başqa qrupa köçürmək və ya xaric etmək — qrup səhifəsində, **Şagirdlər** ikonasında.

### Şagird üzrə hesabat

Şagirdin adına basın — valideynlər üçün hesabat açılacaq. Dövr yuxarıdakı hissədən seçilir: **Ay** (sürüşdürmə ilə), **İldən başlayaraq** — 1 sentyabrdan, **Təhsilə başlayaraq** — şagirdin ilk dərsindən, **Dövr** — istənilən iki tarix. **Çap** düyməsi hesabatı kağıza çıxarır. Keçən ayla müqayisə yalnız aylıq hesabatda var.

- **Bir cümlə ilə nəticə** — dövr necə keçdi və nəyə diqqət yetirmək lazımdır.
- **Ay (dövr) rəqəmlərlə** — iştirak edilən dərslər, təqdim olunan ev tapşırıqları, ulduzlar və dərslər üzrə orta qiymət.
- **İşlər necə gedir** — altı göstərici ilə: dərslərə gedir, vaxtında gəlir, dərsdə necə işləyir, ev tapşırıqlarını təqdim edir və necə yerinə yetirir, imtahanları necə verir.
- **Dövrün əsasları** — nədən qürur duya bilərik və nəyə diqqət yetirmək lazımdır.
- **Dövr üzrə dərslər** — hər bir dərs üzrə: iştirak, qiymət, ev tapşırığı və ulduzlar.

Yaşıl rəng — hər şey qaydasındadır, sarı — kiçik sapma, qırmızı — valideynlərin köməyinə ehtiyac var, boz — hələlik məlumat yoxdur.

## Müəllimlər

[ Müəllimlər ](/dashboard/teachers) bölməsində — hər müəllim üçün xülasə: neçə qrup və şagird, keçirilmiş dərslər, davamiyyət və orta bal. Qruplar və şagirdlər onun əsas müəllim olduğu qruplar üzrə hesablanır; dərslər, davamiyyət və bal — onun özü tərəfindən keçirilmiş dərslər üzrə, əvəz etmələr daxil olmaqla.

### Müəllim üzrə hesabat

Müəllimə klikləyin — hesabat açılacaq. Dövr səhifənin yuxarısında seçilir: **Ay** (sürüşdürmə ilə), **İldən başlayaraq** — 1 sentyabrdan, **Tədrisə başlayaraq** — müəllimin ilk dərsindən, **Dövr** — istənilən iki tarix. **Çap** düyməsi hesabatı kağızda çıxarır. Keçən ay ilə müqayisə yalnız aylıq hesabatda var.

- **Bir cümlə ilə nəticə** — dövr necə keçdi və hansı göstəricilər diqqət tələb edir.
- **Nə qədər işlənib** — cədvələ uyğun keçirilmiş dərslər, fərdi dərslər, saatlar və baş tutmayan dərslər. Keçirilmiş dərs, ən azı bir şagirdin iştirak etdiyi açıq dərs hesab olunur.
- **Necə işlənib** — norma və rənglə birlikdə səkkiz göstərici: davamiyyət, şagirdlərin qalması, jurnalın vaxtında doldurulması, ev tapşırıqlarının verilməsi və tez yoxlanılması, imtahan nəticələrinin artması, şagirdlərin platformadan istifadəsi və dərsləri smileylərlə necə qiymətləndirdikləri.
- **Qruplar üzrə** — müəllimin hər qrupuna aid eyni əsas rəqəmlər.
- **Nəyə diqqət yetirmək lazımdır** — konkret hallar: yoxlanılmamış işlər, ardıcıl üç buraxılışı olan şagirdlər, gedən şagirdlər və səbəb, baş tutmayan dərslər.

Yaşıl rəng — norma yerinə yetirilib, sarı — kiçik sapma, qırmızı — normadan aşağı, boz — hələlik məlumat yoxdur.

Dərs qiymətləri və hesabatdakı ulduzlar daxil deyil: onları müəllim özü qoyur, buna görə də onun işinin keyfiyyəti haqqında hökm vermək olmaz.

## Ziyarətlər

[Ziyarətlər](/dashboard/activity) bölməsində:

- **Bu gün sistemdə** — bu gün kimlər daxil olub; «indiki» — son dəqiqələrdə aktivdir.
- Müəllimlər, şagirdlər və administratorlar üzrə dövr üçün hesabat (bu gün, 7 və ya 30 gün): neçə gün daxil olub, sistemdə vaxt, son aktivlik — yekun və ya günlər üzrə.

## Profil

[Profil](/dashboard/profile) bölməsində parolu dəyişmək mümkündür.
