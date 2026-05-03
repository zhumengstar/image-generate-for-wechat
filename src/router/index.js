import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export const constantRoutes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    component: () => import('@/views/dashboard/index'),
    name: 'Dashboard',
    meta: { title: 'AI 图片生成' }
  },
  {
    path: '*',
    redirect: '/dashboard',
    hidden: true
  }
]

export const asyncRoutes = []

const createRouter = () => new Router({
  scrollBehavior: () => ({ y: 0 }),
  routes: constantRoutes
})

const router = createRouter()

export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher
}

export default router
