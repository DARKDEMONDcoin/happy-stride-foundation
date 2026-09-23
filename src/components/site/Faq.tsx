import { Reveal } from "@/components/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const faqs = [
  {
    q: "هل يعمل الموظفون بالعربية من الأساس؟",
    a: "نعم. سهل مبني للعربية ولهجاتها، لا يترجم نصًا أجنبيًا بعد كتابته. سِراج ونور يكتبان بالعربية، ودانة تضبط النص داخل التصميم، وكل مادة تبقى قابلة للمراجعة.",
  },
  {
    q: "هل ينفذ الفريق مباشرة داخل حساباتي؟",
    a: "بعد ربط الحسابات رسميًا، ينفذ كل موظف المهام التي تسمح بها. تستطيع اشتراط موافقتك قبل النشر أو التواصل أو أي خطوة حساسة.",
  },
  {
    q: "ماذا يحدث عندما أعدل نتيجة؟",
    a: "يحفظ الفريق تعديلك ضمن سياق المشروع ويستخدمه في المهام التالية. تستطيع أيضًا تنزيل المحتوى والبيانات التي تخصك في أي وقت.",
  },
  {
    q: "من يملك بيانات المشروع ومحتواه؟",
    a: "أنت. تُحفظ بياناتك مشفرة، ولا تُستخدم لتدريب نماذج عامة، ويمكنك حذف الحساب وما يتصل به أو تصديره.",
  },
  {
    q: "هل أحتاج إلى إعداد تقني طويل؟",
    a: "لا. تجيب عن أسئلة قصيرة حول نشاطك، تختار الموظفين، وتربط الأدوات التي تحتاجها. بعدها ترسل الهدف بلغة عادية.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-5 py-24">
      <Reveal>
        <p className="text-center text-sm font-bold tracking-wider text-primary">الأسئلة الشائعة</p>
        <h2 className="mt-3 text-center font-display text-4xl font-black md:text-5xl">
          أسئلة متكررة
        </h2>
        <p className="mx-auto mt-4 max-w-md text-center text-muted-foreground">
          لم تجد إجابتك؟ راسلنا وسيردّ عليك إنسان حقيقي خلال يوم عمل.
        </p>
      </Reveal>
      <Reveal delay={80}>
        <Accordion type="single" collapsible className="faq-accordion mt-10 space-y-3">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q} className="faq-item border-border">
              <AccordionTrigger className="faq-trigger px-5 text-right font-display text-lg font-bold hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="faq-answer px-5 text-base leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
